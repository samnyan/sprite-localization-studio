import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { setWorkspaceProjectSessionForTesting, useWorkspaceStore } from '@/app/stores/workspace'
import type { ProjectRepository } from '@/application/project/ProjectRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'

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
      {
        save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined),
      } as unknown as ProjectRepository,
      {} as ProjectStorage,
    )

    await expect(workspace.buildTextures()).resolves.toBe(true)
    expect(workspace.status).toBe('ready')
    expect(workspace.error).toBeUndefined()
  })

  it('keeps project text style template names unique and merges references on replacement', () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    setWorkspaceProjectSessionForTesting(
      {
        save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined),
      } as unknown as ProjectRepository,
      {} as ProjectStorage,
    )
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      textStyleTemplates: [
        { id: 'primary', name: 'Primary', render: { ...DEFAULT_TEXT_RENDER, fontSize: 20 } },
        { id: 'secondary', name: 'Secondary', render: { ...DEFAULT_TEXT_RENDER, fontSize: 14 } },
      ],
      translations: [
        {
          spriteTableId: 'ui',
          spriteId: 'button',
          textRegions: [
            {
              id: 'a',
              translationKey: 'a',
              rect: { x: 0, y: 0, width: 10, height: 10 },
              rotation: 0,
              styleId: 'primary',
            },
            {
              id: 'b',
              translationKey: 'b',
              rect: { x: 0, y: 0, width: 10, height: 10 },
              rotation: 0,
              styleId: 'secondary',
            },
          ],
        },
      ],
    }

    expect(workspace.saveTextStyleTemplate(' primary ', DEFAULT_TEXT_RENDER)).toBeUndefined()
    expect(workspace.renameTextStyleTemplate('primary', 'Secondary')).toBe(false)
    expect(workspace.renameTextStyleTemplate('primary', 'Secondary', 'secondary')).toBe(true)
    expect(workspace.project?.textStyleTemplates).toEqual([
      { id: 'secondary', name: 'Secondary', render: { ...DEFAULT_TEXT_RENDER, fontSize: 20 } },
    ])
    expect(workspace.project?.translations?.[0]?.textRegions).toEqual([
      expect.objectContaining({
        styleId: 'secondary',
        render: { ...DEFAULT_TEXT_RENDER, fontSize: 20 },
      }),
      expect.objectContaining({
        styleId: 'secondary',
        render: { ...DEFAULT_TEXT_RENDER, fontSize: 20 },
      }),
    ])
  })

  it('deletes an in-use background template after moving all references to the selected fallback', async () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    const repository = {
      save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined),
    } as unknown as ProjectRepository
    const storage = {
      delete: vi.fn<(path: string) => Promise<void>>(async () => undefined),
    } as unknown as ProjectStorage
    setWorkspaceProjectSessionForTesting(repository, storage)
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      backgroundTemplates: [
        {
          id: 'template',
          name: 'Template',
          path: 'sprite_base/template/template.png',
          scope: 'template',
        },
      ],
      translations: [
        {
          spriteTableId: 'ui',
          spriteId: 'button',
          backgroundType: 'template',
          backgroundId: 'template',
          textRegions: [],
        },
        {
          spriteTableId: 'ui',
          spriteId: 'label',
          backgroundType: 'original',
          textRegions: [],
        },
      ],
    }

    await expect(workspace.deleteBackgroundTemplate('template', 'blank')).resolves.toBe(true)

    expect(workspace.project?.backgroundTemplates).toEqual([])
    expect(workspace.project?.translations?.[0]).toMatchObject({ backgroundType: 'blank' })
    expect(workspace.project?.translations?.[0]?.backgroundId).toBeUndefined()
    expect(workspace.project?.translations?.[1]).toMatchObject({ backgroundType: 'original' })
    expect(storage.delete).toHaveBeenCalledWith('sprite_base/template/template.png')
  })

  it('keeps an image template name stable when its image file is replaced', async () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    const repository = {
      save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined),
    } as unknown as ProjectRepository
    const storage = {
      delete: vi.fn<(path: string) => Promise<void>>(async () => undefined),
      writeBinary: vi.fn<(path: string, data: Uint8Array) => Promise<void>>(async () => undefined),
    } as unknown as ProjectStorage
    setWorkspaceProjectSessionForTesting(repository, storage)
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      backgroundTemplates: [
        {
          id: 'template',
          name: 'Start button background',
          path: 'sprite_base/template/template.png',
          scope: 'template',
        },
      ],
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:replacement')
    vi.spyOn(URL, 'revokeObjectURL')
    workspace.backgroundImageUrls = { template: 'blob:previous' }
    const replacement = {
      type: 'image/png',
      name: 'replacement.png',
      arrayBuffer: async () => new ArrayBuffer(1),
    } as File

    await expect(workspace.replaceBackgroundTemplate('template', replacement)).resolves.toBe(true)

    expect(workspace.project?.backgroundTemplates?.[0]).toMatchObject({
      id: 'template',
      name: 'Start button background',
    })
    expect(workspace.project?.backgroundTemplates?.[0]?.path).not.toBe(
      'sprite_base/template/template.png',
    )
  })
})
