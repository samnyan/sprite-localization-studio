import { computed, markRaw, ref } from 'vue'
import { defineStore } from 'pinia'

import { ActionHistory, createSnapshotAction } from '@/application/history/ActionHistory'
import { ProjectFormatError, ProjectRepository } from '@/application/project/ProjectRepository'
import {
  SpriteTableFormatError,
  SpriteTableRepository,
} from '@/application/sprite-table/SpriteTableRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import type { ProjectManifest } from '@/domain/project/types'
import type { Rect } from '@/domain/shared/geometry'
import type { SpriteTable } from '@/domain/sprite-table/types'
import type { SpriteTranslation, TextRegion } from '@/domain/text-region/types'
import { LocalFolderStorage } from '@/infrastructure/storage/LocalFolderStorage'
import { supportsLocalFolderProjects } from '@/infrastructure/storage/browserSupport'

type WorkspaceStatus = 'idle' | 'opening' | 'ready' | 'saving' | 'error'

interface WorkspaceError {
  key: string
  params?: Record<string, string | number>
}

type TextureImageUrls = Record<string, Record<string, string>>

const AUTOSAVE_DELAY_MS = 5_000
let activeRepository: ProjectRepository | undefined

function workspaceErrorFrom(error: unknown): WorkspaceError {
  if (error instanceof SpriteTableFormatError) {
    return { key: `errors.spriteTable.${error.code}`, params: error.params }
  }

  if (error instanceof ProjectFormatError) {
    return { key: `errors.project.${error.code}`, params: error.params }
  }

  return {
    key: 'errors.unknown',
    params: { message: error instanceof Error ? error.message : String(error) },
  }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const project = ref<ProjectManifest>()
  const spriteTables = ref<SpriteTable[]>([])
  const textureImageUrls = ref<TextureImageUrls>({})
  const selectedSpriteTableId = ref<string>()
  const selectedSpriteId = ref<string>()
  const selectedTextRegionId = ref<string>()
  const directoryName = ref('')
  const status = ref<WorkspaceStatus>('idle')
  const error = ref<WorkspaceError>()
  const documentRevision = ref(0)
  const persistedRevision = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const history = new ActionHistory<ProjectManifest>()
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined
  let savePromise: Promise<boolean> | undefined
  let documentSession = 0

  const hasProject = computed(() => project.value !== undefined)
  const isBusy = computed(() => status.value === 'opening' || status.value === 'saving')
  const isDirty = computed(() => documentRevision.value !== persistedRevision.value)
  const selectedSpriteTable = computed(() =>
    spriteTables.value.find((spriteTable) => spriteTable.id === selectedSpriteTableId.value),
  )
  const selectedSprite = computed(() =>
    selectedSpriteTable.value?.sprites.find((sprite) => sprite.id === selectedSpriteId.value),
  )
  const selectedTexture = computed(() =>
    selectedSpriteTable.value?.textures.find(
      (texture) => texture.id === selectedSprite.value?.textureId,
    ),
  )
  const selectedSpriteTranslation = computed(() =>
    project.value?.translations?.find(
      (translation) =>
        translation.spriteTableId === selectedSpriteTable.value?.id &&
        translation.spriteId === selectedSprite.value?.id,
    ),
  )
  const selectedTextRegion = computed(() =>
    selectedSpriteTranslation.value?.textRegions.find(
      (region) => region.id === selectedTextRegionId.value,
    ),
  )

  function revokeTextureImageUrls(urls: TextureImageUrls): void {
    for (const textureUrls of Object.values(urls)) {
      for (const url of Object.values(textureUrls)) URL.revokeObjectURL(url)
    }
  }

  async function loadTextureImages(
    storage: ProjectStorage,
    loadedSpriteTables: SpriteTable[],
  ): Promise<TextureImageUrls> {
    const urls: TextureImageUrls = {}

    try {
      for (const spriteTable of loadedSpriteTables) {
        const textureUrls: Record<string, string> = {}
        urls[spriteTable.id] = textureUrls
        for (const texture of spriteTable.textures) {
          const data = await storage.readBinary(`textures/${texture.imagePath}`)
          textureUrls[texture.id] = URL.createObjectURL(new Blob([data], { type: 'image/png' }))
        }
      }
      return urls
    } catch (caughtError) {
      revokeTextureImageUrls(urls)
      throw caughtError
    }
  }

  function clearAutosave(): void {
    if (autosaveTimer !== undefined) clearTimeout(autosaveTimer)
    autosaveTimer = undefined
  }

  function syncHistoryState(): void {
    canUndo.value = history.canUndo
    canRedo.value = history.canRedo
  }

  function resetDocumentHistory(): void {
    clearAutosave()
    history.clear()
    documentRevision.value = 0
    persistedRevision.value = 0
    syncHistoryState()
  }

  function scheduleProjectSave(): void {
    clearAutosave()
    autosaveTimer = setTimeout(() => void saveProject(), AUTOSAVE_DELAY_MS)
  }

  function acceptDocumentState(updated: ProjectManifest): void {
    project.value = updated
    documentRevision.value += 1
    error.value = undefined
    status.value = savePromise ? 'saving' : 'ready'
    syncHistoryState()
    scheduleProjectSave()
  }

  function dispatchProjectAction(type: string, updated: ProjectManifest): boolean {
    const current = project.value
    if (!current || !activeRepository) return failProjectNotOpen()
    if (updated === current) return true
    acceptDocumentState(history.execute(current, createSnapshotAction(type, current, updated)))
    return true
  }

  async function saveProject(): Promise<boolean> {
    clearAutosave()
    if (!project.value || !activeRepository) return failProjectNotOpen()
    if (!isDirty.value) return true
    if (savePromise) return savePromise

    const repository = activeRepository
    const session = documentSession
    savePromise = (async () => {
      try {
        while (
          session === documentSession &&
          project.value &&
          persistedRevision.value !== documentRevision.value
        ) {
          const snapshot = project.value
          const revision = documentRevision.value
          status.value = 'saving'
          error.value = undefined
          await repository.save(snapshot)
          if (session === documentSession) persistedRevision.value = revision
        }
        if (session !== documentSession) return true
        clearAutosave()
        status.value = 'ready'
        return true
      } catch (caughtError) {
        status.value = 'error'
        error.value = workspaceErrorFrom(caughtError)
        return false
      } finally {
        savePromise = undefined
      }
    })()
    return savePromise
  }

  function undo(): boolean {
    const current = project.value
    if (!current || !history.canUndo) return false
    acceptDocumentState(history.undo(current))
    return true
  }

  function redo(): boolean {
    const current = project.value
    if (!current || !history.canRedo) return false
    acceptDocumentState(history.redo(current))
    return true
  }

  async function activateProject(
    directory: FileSystemDirectoryHandle,
    storage: ProjectStorage,
    repository: ProjectRepository,
    loadedProject: ProjectManifest,
  ): Promise<void> {
    const loadedSpriteTables = await new SpriteTableRepository(storage).loadMany(
      loadedProject.spriteTableManifestPaths ?? [],
    )
    const loadedImageUrls = await loadTextureImages(storage, loadedSpriteTables)
    const firstSpriteTable = loadedSpriteTables[0]
    const firstSprite = firstSpriteTable?.sprites[0]

    revokeTextureImageUrls(textureImageUrls.value)
    documentSession += 1
    activeRepository = repository
    project.value = loadedProject
    resetDocumentHistory()
    spriteTables.value = loadedSpriteTables
    textureImageUrls.value = loadedImageUrls
    selectedSpriteTableId.value = firstSpriteTable?.id
    selectedSpriteId.value = firstSprite?.id
    selectedTextRegionId.value = undefined
    directoryName.value = directory.name
  }

  async function openLocalProject(): Promise<boolean> {
    if (!supportsLocalFolderProjects()) {
      status.value = 'error'
      error.value = { key: 'errors.unsupportedBrowser' }
      return false
    }

    status.value = 'opening'
    error.value = undefined
    try {
      const directory = await window.showDirectoryPicker({ mode: 'readwrite' })
      if (isDirty.value && !(await saveProject())) return false
      status.value = 'opening'
      const storage = markRaw(new LocalFolderStorage(directory))
      const repository = markRaw(new ProjectRepository(storage))
      await activateProject(directory, storage, repository, await repository.load())
      status.value = 'ready'
      return true
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === 'AbortError') {
        status.value = project.value ? 'ready' : 'idle'
        return false
      }
      status.value = 'error'
      error.value = workspaceErrorFrom(caughtError)
      return false
    }
  }

  async function createLocalProject(name: string): Promise<boolean> {
    if (!supportsLocalFolderProjects()) {
      status.value = 'error'
      error.value = { key: 'errors.unsupportedBrowser' }
      return false
    }

    status.value = 'opening'
    error.value = undefined
    try {
      const directory = await window.showDirectoryPicker({ mode: 'readwrite' })
      if (isDirty.value && !(await saveProject())) return false
      status.value = 'opening'
      const storage = markRaw(new LocalFolderStorage(directory))
      const repository = markRaw(new ProjectRepository(storage))
      await activateProject(directory, storage, repository, await repository.create(name))
      status.value = 'ready'
      return true
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === 'AbortError') {
        status.value = project.value ? 'ready' : 'idle'
        return false
      }
      status.value = 'error'
      error.value = workspaceErrorFrom(caughtError)
      return false
    }
  }

  function saveProjectName(name: string): boolean {
    if (!project.value) return failProjectNotOpen()
    const trimmedName = name.trim()
    if (!trimmedName) {
      status.value = 'error'
      error.value = { key: 'errors.project.emptyName' }
      return false
    }
    if (trimmedName === project.value.name) return true
    return dispatchProjectAction('project.rename', { ...project.value, name: trimmedName })
  }

  function failProjectNotOpen(): false {
    error.value = { key: 'errors.projectNotOpen' }
    status.value = 'error'
    return false
  }

  function saveTranslations(type: string, translations: SpriteTranslation[]): boolean {
    if (!project.value) return failProjectNotOpen()
    return dispatchProjectAction(type, { ...project.value, translations })
  }

  function translationIdentity(translation: SpriteTranslation): boolean {
    return (
      translation.spriteTableId === selectedSpriteTable.value?.id &&
      translation.spriteId === selectedSprite.value?.id
    )
  }

  function setSpriteTranslationEnabled(enabled: boolean): boolean {
    if (!selectedSprite.value || !selectedSpriteTable.value) return false
    const translations = project.value?.translations ?? []
    const exists = translations.some(translationIdentity)
    if (enabled === exists) return true
    selectedTextRegionId.value = undefined
    return saveTranslations(
      enabled ? 'spriteTranslation.enable' : 'spriteTranslation.disable',
      enabled
        ? [
            ...translations,
            {
              spriteTableId: selectedSpriteTable.value.id,
              spriteId: selectedSprite.value.id,
              textRegions: [],
            },
          ]
        : translations.filter((translation) => !translationIdentity(translation)),
    )
  }

  function addTextRegion(rect: Rect): boolean {
    const translation = selectedSpriteTranslation.value
    if (!translation) return false
    const regionId = crypto.randomUUID()
    const usedTranslationKeys = new Set(
      project.value?.translations?.flatMap((item) =>
        item.textRegions.map((region) => region.translationKey),
      ) ?? [],
    )
    let keyIndex = translation.textRegions.length + 1
    let translationKey = `${translation.spriteTableId}.${translation.spriteId}.${keyIndex}`
    while (usedTranslationKeys.has(translationKey)) {
      keyIndex += 1
      translationKey = `${translation.spriteTableId}.${translation.spriteId}.${keyIndex}`
    }
    const region: TextRegion = {
      id: regionId,
      rect,
      rotation: 0,
      translationKey,
    }
    selectedTextRegionId.value = region.id
    return saveTranslations(
      'textRegion.add',
      (project.value?.translations ?? []).map((item) =>
        translationIdentity(item) ? { ...item, textRegions: [...item.textRegions, region] } : item,
      ),
    )
  }

  function validateTranslationKey(
    regionId: string,
    key: string,
  ): 'empty' | 'duplicate' | undefined {
    const normalizedKey = key.trim()
    if (!normalizedKey) return 'empty'
    const duplicate = project.value?.translations?.some((translation) =>
      translation.textRegions.some(
        (region) =>
          !(translationIdentity(translation) && region.id === regionId) &&
          region.translationKey === normalizedKey,
      ),
    )
    return duplicate ? 'duplicate' : undefined
  }

  function textRegionEquals(left: TextRegion, right: TextRegion): boolean {
    return (
      left.rotation === right.rotation &&
      left.translationKey === right.translationKey &&
      left.styleId === right.styleId &&
      left.rect.x === right.rect.x &&
      left.rect.y === right.rect.y &&
      left.rect.width === right.rect.width &&
      left.rect.height === right.rect.height
    )
  }

  function updateTextRegion(regionId: string, update: Partial<TextRegion>): boolean {
    const normalizedUpdate =
      update.translationKey === undefined
        ? update
        : { ...update, translationKey: update.translationKey.trim() }
    if (
      normalizedUpdate.translationKey !== undefined &&
      validateTranslationKey(regionId, normalizedUpdate.translationKey)
    ) {
      return false
    }

    const currentRegion = selectedSpriteTranslation.value?.textRegions.find(
      (region) => region.id === regionId,
    )
    if (!currentRegion) return false
    const updatedRegion = { ...currentRegion, ...normalizedUpdate }
    if (textRegionEquals(currentRegion, updatedRegion)) return true

    return saveTranslations(
      'textRegion.update',
      (project.value?.translations ?? []).map((translation) =>
        translationIdentity(translation)
          ? {
              ...translation,
              textRegions: translation.textRegions.map((region) =>
                region.id === regionId ? { ...region, ...normalizedUpdate } : region,
              ),
            }
          : translation,
      ),
    )
  }

  function removeTextRegion(regionId: string): boolean {
    selectedTextRegionId.value = undefined
    return saveTranslations(
      'textRegion.remove',
      (project.value?.translations ?? []).map((translation) =>
        translationIdentity(translation)
          ? {
              ...translation,
              textRegions: translation.textRegions.filter((region) => region.id !== regionId),
            }
          : translation,
      ),
    )
  }

  function clearError(): void {
    error.value = undefined
    status.value = project.value ? 'ready' : 'idle'
  }

  function selectSpriteTable(spriteTableId: string): void {
    const spriteTable = spriteTables.value.find((item) => item.id === spriteTableId)
    selectedSpriteTableId.value = spriteTable?.id
    selectedSpriteId.value = undefined
    selectedTextRegionId.value = undefined
  }

  function selectSprite(spriteTableId: string, spriteId: string): void {
    const spriteTable = spriteTables.value.find((item) => item.id === spriteTableId)
    const sprite = spriteTable?.sprites.find((item) => item.id === spriteId)
    if (!spriteTable || !sprite) return
    selectedSpriteTableId.value = spriteTable.id
    selectedSpriteId.value = sprite.id
    selectedTextRegionId.value = undefined
  }

  function selectTextRegion(regionId?: string): void {
    selectedTextRegionId.value = regionId
  }

  function selectProject(): void {
    selectedSpriteTableId.value = undefined
    selectedSpriteId.value = undefined
    selectedTextRegionId.value = undefined
  }

  return {
    project,
    spriteTables,
    textureImageUrls,
    selectedSpriteTableId,
    selectedSpriteId,
    selectedTextRegionId,
    selectedSpriteTable,
    selectedTexture,
    selectedSprite,
    selectedSpriteTranslation,
    selectedTextRegion,
    directoryName,
    status,
    error,
    hasProject,
    isBusy,
    isDirty,
    canUndo,
    canRedo,
    openLocalProject,
    createLocalProject,
    saveProject,
    saveProjectName,
    undo,
    redo,
    setSpriteTranslationEnabled,
    addTextRegion,
    validateTranslationKey,
    updateTextRegion,
    removeTextRegion,
    clearError,
    selectSpriteTable,
    selectSprite,
    selectTextRegion,
    selectProject,
  }
})
