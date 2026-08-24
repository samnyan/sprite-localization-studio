import { computed, markRaw, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  ProjectFormatError,
  ProjectRepository,
} from '@/application/project/ProjectRepository'
import type { ProjectManifest } from '@/domain/project/types'
import { LocalFolderStorage } from '@/infrastructure/storage/LocalFolderStorage'
import { supportsLocalFolderProjects } from '@/infrastructure/storage/browserSupport'

type WorkspaceStatus = 'idle' | 'opening' | 'ready' | 'saving' | 'error'

interface WorkspaceError {
  key: string
  params?: Record<string, string | number>
}

let activeRepository: ProjectRepository | undefined

function workspaceErrorFrom(error: unknown): WorkspaceError {
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
  const directoryName = ref('')
  const status = ref<WorkspaceStatus>('idle')
  const error = ref<WorkspaceError>()

  const hasProject = computed(() => project.value !== undefined)
  const isBusy = computed(() => status.value === 'opening' || status.value === 'saving')

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
      const repository = markRaw(new ProjectRepository(new LocalFolderStorage(directory)))
      const loadedProject = await repository.load()

      activeRepository = repository
      project.value = loadedProject
      directoryName.value = directory.name
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
      const repository = markRaw(new ProjectRepository(new LocalFolderStorage(directory)))
      const createdProject = await repository.create(name)

      activeRepository = repository
      project.value = createdProject
      directoryName.value = directory.name
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

  return {
    project,
    directoryName,
    status,
    error,
    hasProject,
    isBusy,
    openLocalProject,
    createLocalProject,
    saveProjectName,
    clearError,
  }
})
