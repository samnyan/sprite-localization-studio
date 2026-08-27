import { computed, markRaw, ref } from 'vue'
import { defineStore } from 'pinia'

import { ProjectFormatError, ProjectRepository } from '@/application/project/ProjectRepository'
import {
  SpriteTableFormatError,
  SpriteTableRepository,
} from '@/application/sprite-table/SpriteTableRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import type { ProjectManifest } from '@/domain/project/types'
import type { SpriteTable } from '@/domain/sprite-table/types'
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
    return {
      key: `errors.spriteTable.${error.code}`,
      params: error.params,
    }
  }

  if (error instanceof ProjectFormatError) {
    return {
      key: `errors.project.${error.code}`,
      params: error.params,
    }
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

  function revokeTextureImageUrls(urls: TextureImageUrls): void {
    for (const textureUrls of Object.values(urls)) {
      for (const url of Object.values(textureUrls)) {
        URL.revokeObjectURL(url)
      }
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
      const loadedProject = await repository.load()

      await activateProject(directory, storage, repository, loadedProject)
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
      const createdProject = await repository.create(name)

      await activateProject(directory, storage, repository, createdProject)
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
    if (!project.value || !activeRepository) {
      error.value = { key: 'errors.projectNotOpen' }
      status.value = 'error'
      return false
    }

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

  function clearError(): void {
    error.value = undefined
    status.value = project.value ? 'ready' : 'idle'
  }

  function selectSpriteTable(spriteTableId: string): void {
    const spriteTable = spriteTables.value.find((item) => item.id === spriteTableId)
    selectedSpriteTableId.value = spriteTable?.id
    selectedSpriteId.value = undefined
  }

  function selectSprite(spriteTableId: string, spriteId: string): void {
    const spriteTable = spriteTables.value.find((item) => item.id === spriteTableId)
    const sprite = spriteTable?.sprites.find((item) => item.id === spriteId)

    if (!spriteTable || !sprite) return

    selectedSpriteTableId.value = spriteTable.id
    selectedSpriteId.value = sprite.id
  }

  function selectProject(): void {
    selectedSpriteTableId.value = undefined
    selectedSpriteId.value = undefined
  }

  return {
    project,
    spriteTables,
    textureImageUrls,
    selectedSpriteTableId,
    selectedSpriteId,
    selectedSpriteTable,
    selectedTexture,
    selectedSprite,
    directoryName,
    status,
    error,
    hasProject,
    isBusy,
    openLocalProject,
    createLocalProject,
    saveProjectName,
    clearError,
    selectSpriteTable,
    selectSprite,
    selectProject,
  }
})
