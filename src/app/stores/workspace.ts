import { computed, markRaw, ref } from 'vue'
import { defineStore } from 'pinia'

import { ActionHistory, createSnapshotAction } from '@/application/history/ActionHistory'
import { scanProjectFonts } from '@/application/font/ProjectFontCatalog'
import { collectTextDiagnostics, type TextDiagnostic } from '@/application/qa/TextDiagnostics'
import {
  createBackgroundTemplatePath,
  createSpriteBackgroundPath,
} from '@/application/assets/backgroundPath'
import {
  runLocalizedTextureBuild,
  type LocalizedTextureBuildReport,
} from '@/application/build/LocalizedTextureBuild'
import {
  isTextRenderConfig,
  ProjectFormatError,
  ProjectRepository,
} from '@/application/project/ProjectRepository'
import {
  SpriteTableFormatError,
  SpriteTableRepository,
} from '@/application/sprite-table/SpriteTableRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import type { ProjectManifest } from '@/domain/project/types'
import type { FontDiagnostic, ProjectFont } from '@/domain/font/types'
import type { BackgroundTemplate, ImageResource, SpriteBackground } from '@/domain/resource/types'
import type { Rect } from '@/domain/shared/geometry'
import type { SpriteTable } from '@/domain/sprite-table/types'
import {
  resolveBackgroundType,
  type SpriteTranslation,
  type TextRegion,
  type TextRenderConfig,
  type TextStyleTemplate,
} from '@/domain/text-region/types'
import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import { LocalFolderStorage } from '@/infrastructure/storage/LocalFolderStorage'
import { CanvasTextureBuilder } from '@/infrastructure/image/CanvasTextureBuilder'
import { projectFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'
import { canvasKitTypefaceCache } from '@/infrastructure/rendering/CanvasKitTypefaceCache'
import { supportsLocalFolderProjects } from '@/infrastructure/storage/browserSupport'

type WorkspaceStatus = 'idle' | 'opening' | 'ready' | 'saving' | 'building' | 'error'
export type WorkspaceMode = 'sprites' | 'translations'
export type PreviewBackground = 'transparent' | 'black' | 'white'

interface WorkspaceError {
  key: string
  params?: Record<string, string | number>
}

interface ResourceOperation {
  project: ProjectManifest
  revision: number
  session: number
  storage: ProjectStorage
}

type TextureImageUrls = Record<string, Record<string, string>>
type BackgroundImageUrls = Record<string, string>

const AUTOSAVE_DELAY_MS = 5_000
let activeRepository: ProjectRepository | undefined
let activeStorage: ProjectStorage | undefined
let projectActivation = 0

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
  const backgroundImageUrls = ref<BackgroundImageUrls>({})
  const projectFonts = ref<ProjectFont[]>([])
  const fontDiagnostics = ref<FontDiagnostic[]>([])
  const selectedSpriteTableId = ref<string>()
  const selectedSpriteId = ref<string>()
  const selectedTextRegionId = ref<string>()
  const directoryName = ref('')
  const status = ref<WorkspaceStatus>('idle')
  const error = ref<WorkspaceError>()
  const mode = ref<WorkspaceMode>('sprites')
  const previewBackground = ref<PreviewBackground>('transparent')
  const lastBuildReport = ref<LocalizedTextureBuildReport>()
  const lastSavedAt = ref<Date>()
  const documentRevision = ref(0)
  const persistedRevision = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const history = new ActionHistory<ProjectManifest>()
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined
  let savePromise: Promise<boolean> | undefined
  let documentSession = 0
  let activeResourceOperation: ResourceOperation | undefined

  const hasProject = computed(() => project.value !== undefined)
  const isBusy = computed(
    () => status.value === 'opening' || status.value === 'saving' || status.value === 'building',
  )
  const isDirty = computed(() => documentRevision.value !== persistedRevision.value)
  const textDiagnostics = computed(() => project.value ? collectTextDiagnostics(project.value) : [])
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

  const selectedBackgroundTemplate = computed(() =>
    project.value?.backgroundTemplates?.find(
      (background) => background.id === selectedSpriteTranslation.value?.backgroundId,
    ),
  )

  function revokeTextureImageUrls(urls: TextureImageUrls): void {
    for (const textureUrls of Object.values(urls)) {
      for (const url of Object.values(textureUrls)) URL.revokeObjectURL(url)
    }
  }

  function revokeBackgroundImageUrls(urls: BackgroundImageUrls): void {
    for (const url of Object.values(urls)) URL.revokeObjectURL(url)
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

  async function loadBackgroundImages(
    storage: ProjectStorage,
    backgrounds: ImageResource[],
  ): Promise<BackgroundImageUrls> {
    const urls: BackgroundImageUrls = {}

    try {
      for (const background of backgrounds) {
        const data = await storage.readBinary(background.path)
        urls[background.id] = URL.createObjectURL(new Blob([data], { type: 'image/png' }))
      }
      return urls
    } catch (caughtError) {
      revokeBackgroundImageUrls(urls)
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
    lastSavedAt.value = undefined
    syncHistoryState()
  }

  function scheduleProjectSave(): void {
    clearAutosave()
    autosaveTimer = setTimeout(() => void saveProject(), AUTOSAVE_DELAY_MS)
  }

  function beginResourceOperation(): ResourceOperation | undefined {
    if (!project.value || !activeStorage) {
      failProjectNotOpen()
      return undefined
    }
    if (activeResourceOperation) return undefined

    clearAutosave()
    const operation: ResourceOperation = {
      project: project.value,
      revision: documentRevision.value,
      session: documentSession,
      storage: activeStorage,
    }
    activeResourceOperation = operation
    return operation
  }

  function finishResourceOperation(operation: ResourceOperation): void {
    if (activeResourceOperation === operation) activeResourceOperation = undefined
  }

  function isCurrentResourceOperation(operation: ResourceOperation): boolean {
    return (
      operation.session === documentSession &&
      operation.storage === activeStorage &&
      operation.project === project.value &&
      operation.revision === documentRevision.value
    )
  }

  function isCurrentResourceSession(operation: ResourceOperation): boolean {
    return operation.session === documentSession && operation.storage === activeStorage
  }

  function acceptDocumentState(updated: ProjectManifest): void {
    project.value = updated
    documentRevision.value += 1
    error.value = undefined
    status.value = savePromise ? 'saving' : 'ready'
    syncHistoryState()
    scheduleProjectSave()
  }

  function dispatchProjectAction(
    type: string,
    updated: ProjectManifest,
    allowDuringResourceOperation = false,
  ): boolean {
    const current = project.value
    if (!current || !activeRepository) return failProjectNotOpen()
    if (activeResourceOperation && !allowDuringResourceOperation) return false
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
        lastSavedAt.value = new Date()
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

  async function persistAssetProject(
    operation: { project: ProjectManifest; revision: number; session: number; storage: ProjectStorage },
    updated: ProjectManifest,
  ): Promise<boolean> {
    const repository = activeRepository
    if (!repository || !isCurrentResourceOperation(operation)) return false
    if (savePromise && !(await savePromise)) return false
    if (!isCurrentResourceOperation(operation) || activeRepository !== repository) return false

    status.value = 'saving'
    error.value = undefined
    try {
      await repository.save(updated)
      if (!isCurrentResourceOperation(operation) || activeRepository !== repository) return false
      project.value = updated
      resetDocumentHistory()
      lastSavedAt.value = new Date()
      status.value = 'ready'
      return true
    } catch (caughtError) {
      if (isCurrentResourceOperation(operation) && activeRepository === repository) {
        status.value = 'error'
        error.value = workspaceErrorFrom(caughtError)
      }
      return false
    }
  }

  async function removeResourceFile(storage: ProjectStorage, path: string): Promise<void> {
    try {
      await storage.delete(path)
    } catch {
      return
    }
  }

  async function buildTextures(): Promise<boolean> {
    if (!project.value || !activeStorage) return failProjectNotOpen()
    const session = documentSession
    if (!(await saveProject())) return false
    if (session !== documentSession || !project.value || !activeStorage) return false

    const projectSnapshot = structuredClone(project.value)
    const spriteTablesSnapshot = structuredClone(spriteTables.value)
    const storage = activeStorage
    status.value = 'building'
    error.value = undefined

    try {
      const result = await runLocalizedTextureBuild(
        projectSnapshot,
        spriteTablesSnapshot,
        () => markRaw(new CanvasTextureBuilder(storage, projectSnapshot)),
      )
      if (result.status === 'blocked') {
        if (session === documentSession) {
          status.value = 'error'
          error.value = { key: 'errors.build.blockedByTextDiagnostics' }
        }
        return false
      }
      if (session === documentSession) {
        lastBuildReport.value = result.report
        status.value = 'ready'
      }
      return true
    } catch (caughtError) {
      if (session === documentSession) {
        status.value = 'error'
        error.value = workspaceErrorFrom(caughtError)
      }
      return false
    }
  }

  function undo(): boolean {
    const current = project.value
    if (activeResourceOperation || !current || !history.canUndo) return false
    acceptDocumentState(history.undo(current))
    return true
  }

  function redo(): boolean {
    const current = project.value
    if (activeResourceOperation || !current || !history.canRedo) return false
    acceptDocumentState(history.redo(current))
    return true
  }

  async function activateProject(
    directory: FileSystemDirectoryHandle,
    storage: ProjectStorage,
    repository: ProjectRepository,
    loadedProject: ProjectManifest,
    activation: number,
  ): Promise<boolean> {
    const loadedSpriteTables = await new SpriteTableRepository(storage).loadMany(
      loadedProject.spriteTableManifestPaths ?? [],
    )
    if (activation !== projectActivation) return false
    const loadedImageUrls = await loadTextureImages(storage, loadedSpriteTables)
    if (activation !== projectActivation) {
      revokeTextureImageUrls(loadedImageUrls)
      return false
    }
    const loadedBackgroundUrls = await loadBackgroundImages(storage, [
      ...(loadedProject.backgroundTemplates ?? []),
      ...(loadedProject.spriteBackgrounds ?? []),
    ])
    if (activation !== projectActivation) {
      revokeTextureImageUrls(loadedImageUrls)
      revokeBackgroundImageUrls(loadedBackgroundUrls)
      return false
    }
    const loadedFonts = await scanProjectFonts(storage)
    if (activation !== projectActivation) {
      revokeTextureImageUrls(loadedImageUrls)
      revokeBackgroundImageUrls(loadedBackgroundUrls)
      return false
    }
    const fontRegistration = await projectFontRegistry.register(storage, loadedFonts.fonts)
    if (activation !== projectActivation) {
      revokeTextureImageUrls(loadedImageUrls)
      revokeBackgroundImageUrls(loadedBackgroundUrls)
      return false
    }
    const firstSpriteTable = loadedSpriteTables[0]
    const firstSprite = firstSpriteTable?.sprites[0]

    revokeTextureImageUrls(textureImageUrls.value)
    revokeBackgroundImageUrls(backgroundImageUrls.value)
    canvasKitTypefaceCache.dispose()
    documentSession += 1
    activeRepository = repository
    activeStorage = storage
    project.value = loadedProject
    resetDocumentHistory()
    spriteTables.value = loadedSpriteTables
    textureImageUrls.value = loadedImageUrls
    backgroundImageUrls.value = loadedBackgroundUrls
    projectFonts.value = loadedFonts.fonts.filter((font) => fontRegistration.registeredIds.includes(font.id))
    fontDiagnostics.value = [...loadedFonts.diagnostics, ...fontRegistration.diagnostics]
    selectedSpriteTableId.value = firstSpriteTable?.id
    selectedSpriteId.value = firstSprite?.id
    selectedTextRegionId.value = undefined
    directoryName.value = directory.name
    return true
  }

  async function openLocalProject(): Promise<boolean> {
    if (!supportsLocalFolderProjects()) {
      status.value = 'error'
      error.value = { key: 'errors.unsupportedBrowser' }
      return false
    }

    const activation = ++projectActivation
    status.value = 'opening'
    error.value = undefined
    try {
      const directory = await window.showDirectoryPicker({ mode: 'readwrite' })
      if (activation !== projectActivation) return false
      if (isDirty.value && !(await saveProject())) return false
      status.value = 'opening'
      const storage = markRaw(new LocalFolderStorage(directory))
      const repository = markRaw(new ProjectRepository(storage))
      const loadedProject = await repository.load()
      if (activation !== projectActivation) return false
      if (!(await activateProject(directory, storage, repository, loadedProject, activation))) return false
      status.value = 'ready'
      return true
    } catch (caughtError) {
      if (activation !== projectActivation) return false
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

    const activation = ++projectActivation
    status.value = 'opening'
    error.value = undefined
    try {
      const directory = await window.showDirectoryPicker({ mode: 'readwrite' })
      if (activation !== projectActivation) return false
      if (isDirty.value && !(await saveProject())) return false
      status.value = 'opening'
      const storage = markRaw(new LocalFolderStorage(directory))
      const repository = markRaw(new ProjectRepository(storage))
      const loadedProject = await repository.create(name)
      if (activation !== projectActivation) return false
      if (!(await activateProject(directory, storage, repository, loadedProject, activation))) return false
      status.value = 'ready'
      return true
    } catch (caughtError) {
      if (activation !== projectActivation) return false
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
      left.sourceText === right.sourceText &&
      left.translatedText === right.translatedText &&
      JSON.stringify(left.render) === JSON.stringify(right.render) &&
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

  function updateTranslationRegion(
    spriteTableId: string,
    spriteId: string,
    regionId: string,
    update: Pick<TextRegion, 'sourceText' | 'translatedText' | 'render' | 'styleId'>,
  ): boolean {
    const translation = project.value?.translations?.find(
      (item) => item.spriteTableId === spriteTableId && item.spriteId === spriteId,
    )
    const region = translation?.textRegions.find((item) => item.id === regionId)
    if (!translation || !region) return false

    const updatedRegion = { ...region, ...update }
    if (updatedRegion.render !== undefined && !isTextRenderConfig(updatedRegion.render)) return false
    if (textRegionEquals(region, updatedRegion)) return true

    return saveTranslations(
      'translationRegion.update',
      (project.value?.translations ?? []).map((item) =>
        item === translation
          ? {
              ...item,
              textRegions: item.textRegions.map((itemRegion) =>
                itemRegion.id === regionId ? updatedRegion : itemRegion,
              ),
            }
          : item,
      ),
    )
  }

  function updateTranslationText(
    spriteTableId: string,
    spriteId: string,
    regionId: string,
    field: 'sourceText' | 'translatedText',
    value: string,
  ): boolean {
    return updateTranslationRegion(spriteTableId, spriteId, regionId, { [field]: value })
  }

  function updateTranslationRender(
    spriteTableId: string,
    spriteId: string,
    regionId: string,
    update: Partial<TextRenderConfig>,
  ): boolean {
    const translation = project.value?.translations?.find(
      (item) => item.spriteTableId === spriteTableId && item.spriteId === spriteId,
    )
    const region = translation?.textRegions.find((item) => item.id === regionId)
    if (!region) return false

    return updateTranslationRegion(spriteTableId, spriteId, regionId, {
      render: { ...DEFAULT_TEXT_RENDER, ...region.render, ...update },
    })
  }

  function saveTextStyleTemplate(
    name: string,
    render: TextRenderConfig,
    id?: string,
  ): string | undefined {
    if (!project.value || !name.trim() || !isTextRenderConfig(render)) return undefined

    const templates = project.value.textStyleTemplates ?? []
    const templateId = id ?? crypto.randomUUID()
    const template: TextStyleTemplate = {
      id: templateId,
      name: name.trim(),
      render: JSON.parse(JSON.stringify(render)) as TextRenderConfig,
    }
    if (id && !templates.some((item) => item.id === id)) return undefined
    const updatedTranslations = id
      ? (project.value.translations ?? []).map((translation) => ({
          ...translation,
          textRegions: translation.textRegions.map((region) =>
            region.styleId === id
              ? { ...region, render: JSON.parse(JSON.stringify(template.render)) as TextRenderConfig }
              : region,
          ),
        }))
      : project.value.translations
    const textStyleTemplates = id
      ? templates.map((item) => (item.id === id ? template : item))
      : [...templates, template]
    if (
      !dispatchProjectAction('textStyleTemplate.save', {
        ...project.value,
        textStyleTemplates,
        ...(updatedTranslations ? { translations: updatedTranslations } : {}),
      })
    ) {
      return undefined
    }
    return templateId
  }

  function textStyleTemplateReferenceCount(id: string): number {
    return (
      project.value?.translations?.flatMap((translation) => translation.textRegions).filter(
        (region) => region.styleId === id,
      ).length ?? 0
    )
  }

  function deleteTextStyleTemplate(id: string): boolean {
    if (!project.value || textStyleTemplateReferenceCount(id) > 0) return false
    const textStyleTemplates = project.value.textStyleTemplates?.filter(
      (template) => template.id !== id,
    )
    if (!textStyleTemplates || textStyleTemplates.length === project.value.textStyleTemplates?.length) {
      return false
    }
    return dispatchProjectAction('textStyleTemplate.delete', { ...project.value, textStyleTemplates })
  }

  function setSpriteTranslationBackground(
    spriteTableId: string,
    spriteId: string,
    backgroundId?: string,
    backgroundType: 'original' | 'blank' | 'template' | 'sprite' = backgroundId
      ? 'template'
      : 'original',
  ): boolean {
    if (!isValidBackgroundSelection(spriteTableId, spriteId, backgroundType, backgroundId)) {
      return false
    }

    return saveTranslations(
      'spriteTranslation.background',
      (project.value?.translations ?? []).map((translation) =>
        translation.spriteTableId === spriteTableId && translation.spriteId === spriteId
          ? { ...translation, backgroundId, backgroundType }
          : translation,
      ),
    )
  }

  async function addBackgroundTemplate(file: File): Promise<string | undefined> {
    if (!file.type.startsWith('image/')) return undefined
    const operation = beginResourceOperation()
    if (!operation) return undefined
    status.value = 'saving'
    error.value = undefined

    const id = crypto.randomUUID()
    const background: BackgroundTemplate = {
      id,
      name: file.name,
      path: createBackgroundTemplatePath(id, file.name),
      scope: 'template',
    }

    try {
      await operation.storage.writeBinary(
        background.path,
        new Uint8Array(await file.arrayBuffer()),
      )
      if (!isCurrentResourceOperation(operation)) {
        await removeResourceFile(operation.storage, background.path)
        return undefined
      }
      const url = URL.createObjectURL(file)
      const backgroundTemplates = [...(operation.project.backgroundTemplates ?? []), background]
      if (
        !dispatchProjectAction('backgroundTemplate.add', {
          ...operation.project,
          backgroundTemplates,
        }, true)
      ) {
        URL.revokeObjectURL(url)
        await removeResourceFile(operation.storage, background.path)
        return undefined
      }
      backgroundImageUrls.value = {
        ...backgroundImageUrls.value,
        [background.id]: url,
      }
      return background.id
    } catch (caughtError) {
      if (isCurrentResourceOperation(operation)) {
        status.value = 'error'
        error.value = workspaceErrorFrom(caughtError)
      }
      return undefined
    } finally {
      finishResourceOperation(operation)
    }
  }

  async function addSpriteBackground(
    spriteTableId: string,
    spriteId: string,
    file: File,
  ): Promise<string | undefined> {
    if (!file.type.startsWith('image/')) return undefined
    const operation = beginResourceOperation()
    if (!operation) return undefined
    status.value = 'saving'
    error.value = undefined

    const id = crypto.randomUUID()
    const background: SpriteBackground = {
      id,
      name: file.name,
      path: createSpriteBackgroundPath(spriteTableId, spriteId, id, file.name),
      scope: 'sprite',
      spriteTableId,
      spriteId,
    }

    try {
      await operation.storage.writeBinary(
        background.path,
        new Uint8Array(await file.arrayBuffer()),
      )
      if (!isCurrentResourceOperation(operation)) {
        await removeResourceFile(operation.storage, background.path)
        return undefined
      }
      const url = URL.createObjectURL(file)
      const spriteBackgrounds = [...(operation.project.spriteBackgrounds ?? []), background]
      if (!dispatchProjectAction(
        'spriteBackground.add',
        { ...operation.project, spriteBackgrounds },
        true,
      )) {
        URL.revokeObjectURL(url)
        await removeResourceFile(operation.storage, background.path)
        return undefined
      }
      backgroundImageUrls.value = { ...backgroundImageUrls.value, [background.id]: url }
      return background.id
    } catch (caughtError) {
      if (isCurrentResourceOperation(operation)) {
        status.value = 'error'
        error.value = workspaceErrorFrom(caughtError)
      }
      return undefined
    } finally {
      finishResourceOperation(operation)
    }
  }

  function spriteBackgroundsForSprite(
    spriteTableId: string,
    spriteId: string,
  ): SpriteBackground[] {
    return (project.value?.spriteBackgrounds ?? []).filter(
      (background) =>
        background.spriteTableId === spriteTableId && background.spriteId === spriteId,
    )
  }

  function backgroundTemplateReferenceCount(id: string): number {
    return (
      project.value?.translations?.filter(
        (translation) =>
          resolveBackgroundType(translation) === 'template' && translation.backgroundId === id,
      ).length ?? 0
    )
  }

  function renameBackgroundTemplate(id: string, name: string): boolean {
    const trimmedName = name.trim()
    if (!project.value || !trimmedName) return false
    const backgroundTemplates = project.value.backgroundTemplates?.map((background) =>
      background.id === id ? { ...background, name: trimmedName } : background,
    )
    if (!backgroundTemplates?.some((background) => background.id === id)) return false
    return dispatchProjectAction('backgroundTemplate.rename', {
      ...project.value,
      backgroundTemplates,
    })
  }

  async function replaceBackgroundTemplate(id: string, file: File): Promise<boolean> {
    if (!file.type.startsWith('image/')) return false
    const existing = project.value?.backgroundTemplates?.find((background) => background.id === id)
    if (!existing) return false
    const operation = beginResourceOperation()
    const current = operation?.project.backgroundTemplates?.find((background) => background.id === id)
    if (!operation || !current) return false
    status.value = 'saving'
    error.value = undefined

    const path = createBackgroundTemplatePath(`${id}-${crypto.randomUUID()}`, file.name)
    try {
      await operation.storage.writeBinary(path, new Uint8Array(await file.arrayBuffer()))
      if (!isCurrentResourceOperation(operation)) {
        await removeResourceFile(operation.storage, path)
        return false
      }
      const updated: BackgroundTemplate = { ...current, name: file.name, path }
      const backgroundTemplates = operation.project.backgroundTemplates?.map((background) =>
        background.id === id ? updated : background,
      )
      if (!backgroundTemplates) return false
      if (!(await persistAssetProject(operation, { ...operation.project, backgroundTemplates }))) {
        await removeResourceFile(operation.storage, path)
        return false
      }
      status.value = 'saving'
      await removeResourceFile(operation.storage, current.path)
      if (!isCurrentResourceSession(operation)) return false
      const oldUrl = backgroundImageUrls.value[id]
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      backgroundImageUrls.value = { ...backgroundImageUrls.value, [id]: URL.createObjectURL(file) }
      status.value = 'ready'
      return true
    } catch (caughtError) {
      if (isCurrentResourceOperation(operation)) {
        status.value = 'error'
        error.value = workspaceErrorFrom(caughtError)
      }
      return false
    } finally {
      finishResourceOperation(operation)
    }
  }

  async function deleteBackgroundTemplate(id: string): Promise<boolean> {
    const existing = project.value?.backgroundTemplates?.find((background) => background.id === id)
    if (!existing || backgroundTemplateReferenceCount(id) > 0) return false
    const operation = beginResourceOperation()
    const current = operation?.project.backgroundTemplates?.find((background) => background.id === id)
    if (!operation || !current) return false
    status.value = 'saving'
    error.value = undefined

    const backgroundTemplates = operation.project.backgroundTemplates?.filter(
      (background) => background.id !== id,
    )
    if (!backgroundTemplates) return false
    try {
      if (!(await persistAssetProject(operation, { ...operation.project, backgroundTemplates }))) {
        return false
      }
      status.value = 'saving'
      await removeResourceFile(operation.storage, current.path)
      if (!isCurrentResourceSession(operation)) return false
      const url = backgroundImageUrls.value[id]
      if (url) URL.revokeObjectURL(url)
      backgroundImageUrls.value = Object.fromEntries(
        Object.entries(backgroundImageUrls.value).filter(([resourceId]) => resourceId !== id),
      )
      status.value = 'ready'
      return true
    } catch (caughtError) {
      if (isCurrentResourceOperation(operation)) {
        status.value = 'error'
        error.value = workspaceErrorFrom(caughtError)
      }
      return false
    } finally {
      finishResourceOperation(operation)
    }
  }

  function isValidBackgroundSelection(
    spriteTableId: string,
    spriteId: string,
    backgroundType: SpriteTranslation['backgroundType'],
    backgroundId: string | undefined,
  ): boolean {
    if (backgroundType === 'original' || backgroundType === 'blank') return !backgroundId
    if (!backgroundId) return false
    if (backgroundType === 'template') {
      return (
        project.value?.backgroundTemplates?.some((background) => background.id === backgroundId) ??
        false
      )
    }
    return spriteBackgroundsForSprite(spriteTableId, spriteId).some(
      (background) => background.id === backgroundId,
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

  function selectTextDiagnostic(diagnostic: TextDiagnostic): boolean {
    const spriteTable = spriteTables.value.find((item) => item.id === diagnostic.spriteTableId)
    const sprite = spriteTable?.sprites.find((item) => item.id === diagnostic.spriteId)
    const textRegion = project.value?.translations
      ?.find(
        (item) =>
          item.spriteTableId === diagnostic.spriteTableId && item.spriteId === diagnostic.spriteId,
      )
      ?.textRegions.find((item) => item.id === diagnostic.regionId)
    if (!spriteTable || !sprite || !textRegion) return false

    selectedSpriteTableId.value = spriteTable.id
    selectedSpriteId.value = sprite.id
    selectedTextRegionId.value = textRegion.id
    return true
  }

  function selectProject(): void {
    selectedSpriteTableId.value = undefined
    selectedSpriteId.value = undefined
    selectedTextRegionId.value = undefined
  }

  function setMode(nextMode: WorkspaceMode): void {
    mode.value = nextMode
  }

  function setPreviewBackground(nextBackground: PreviewBackground): void {
    previewBackground.value = nextBackground
  }

  return {
    project,
    spriteTables,
    textureImageUrls,
    backgroundImageUrls,
    projectFonts,
    fontDiagnostics,
    textDiagnostics,
    selectedSpriteTableId,
    selectedSpriteId,
    selectedTextRegionId,
    selectedSpriteTable,
    selectedTexture,
    selectedSprite,
    selectedSpriteTranslation,
    selectedTextRegion,
    selectedBackgroundTemplate,
    directoryName,
    status,
    error,
    hasProject,
    isBusy,
    isDirty,
    canUndo,
    canRedo,
    mode,
    previewBackground,
    lastBuildReport,
    lastSavedAt,
    openLocalProject,
    createLocalProject,
    saveProject,
    buildTextures,
    saveProjectName,
    undo,
    redo,
    setSpriteTranslationEnabled,
    addTextRegion,
    validateTranslationKey,
    updateTextRegion,
    updateTranslationText,
    updateTranslationRegion,
    updateTranslationRender,
    saveTextStyleTemplate,
    textStyleTemplateReferenceCount,
    deleteTextStyleTemplate,
    setSpriteTranslationBackground,
    addBackgroundTemplate,
    addSpriteBackground,
    spriteBackgroundsForSprite,
    backgroundTemplateReferenceCount,
    renameBackgroundTemplate,
    replaceBackgroundTemplate,
    deleteBackgroundTemplate,
    removeTextRegion,
    clearError,
    selectSpriteTable,
    selectSprite,
    selectTextRegion,
    selectTextDiagnostic,
    selectProject,
    setMode,
    setPreviewBackground,
  }
})
