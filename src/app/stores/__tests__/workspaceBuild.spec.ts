import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import {
  setWorkspaceProjectSessionForTesting,
  useWorkspaceStore,
} from '@/app/stores/workspace'
import type { ProjectRepository } from '@/application/project/ProjectRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'

afterEach(() => {
  setWorkspaceProjectSessionForTesting()
  vi.restoreAllMocks()
})

describe('workspace texture builds', () => {
  it('converts reactive project data into cloneable build snapshots', async () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    workspace.project = { schemaVersion: 3, name: 'Example' }
    workspace.spriteTables = []
    setWorkspaceProjectSessionForTesting(
      { save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined) } as unknown as ProjectRepository,
      {} as ProjectStorage,
    )

    await expect(workspace.buildTextures()).resolves.toBe(true)
    expect(workspace.status).toBe('ready')
    expect(workspace.error).toBeUndefined()
  })
})
