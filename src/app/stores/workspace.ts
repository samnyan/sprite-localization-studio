import { computed, markRaw, ref } from 'vue'
import { defineStore } from 'pinia'

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

  const hasProject = computed(() => project.value !== undefined)
  const isBusy = computed(() => status.value === 'opening' || status.value === 'saving')
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
    activeRepository = repository
    project.value = loadedProject
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

  async function saveProjectName(name: string): Promise<boolean> {
    if (!project.value || !activeRepository) return failProjectNotOpen()
    status.value = 'saving'
    error.value = undefined
    try {
      project.value = await activeRepository.rename(project.value, name)
      status.value = 'ready'
      return true
    } catch (caughtError) {
      status.value = 'error'
      error.value = workspaceErrorFrom(caughtError)
      return false
    }
  }

  function failProjectNotOpen(): false {
    error.value = { key: 'errors.projectNotOpen' }
    status.value = 'error'
    return false
  }

  async function saveTranslations(translations: SpriteTranslation[]): Promise<boolean> {
    if (!project.value || !activeRepository) return failProjectNotOpen()
    status.value = 'saving'
    error.value = undefined
    const updated = { ...project.value, translations }
    project.value = updated
    try {
      await activeRepository.save(updated)
      status.value = 'ready'
      return true
    } catch (caughtError) {
      status.value = 'error'
      error.value = workspaceErrorFrom(caughtError)
      return false
    }
  }

  function translationIdentity(translation: SpriteTranslation): boolean {
    return (
      translation.spriteTableId === selectedSpriteTable.value?.id &&
      translation.spriteId === selectedSprite.value?.id
    )
  }

  async function setSpriteTranslationEnabled(enabled: boolean): Promise<boolean> {
    if (!selectedSprite.value || !selectedSpriteTable.value) return false
    const translations = project.value?.translations ?? []
    const exists = translations.some(translationIdentity)
    if (enabled === exists) return true
    selectedTextRegionId.value = undefined
    return saveTranslations(
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

  async function addTextRegion(rect: Rect): Promise<boolean> {
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

  async function updateTextRegion(regionId: string, update: Partial<TextRegion>): Promise<boolean> {
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

    return saveTranslations(
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

  async function removeTextRegion(regionId: string): Promise<boolean> {
    selectedTextRegionId.value = undefined
    return saveTranslations(
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
    openLocalProject,
    createLocalProject,
    saveProjectName,
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
