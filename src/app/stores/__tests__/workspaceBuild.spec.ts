import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { setWorkspaceProjectSessionForTesting, useWorkspaceStore } from '@/app/stores/workspace'
import type { ProjectRepository } from '@/application/project/ProjectRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'

afterEach(() => {
  setWorkspaceProjectSessionForTesting()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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

  it('creates a full-size text region using the sprite logical dimensions', async () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    setWorkspaceProjectSessionForTesting({
      save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined),
    } as unknown as ProjectRepository)
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      translations: [{ spriteTableId: 'ui', spriteId: 'vertical-label', textRegions: [] }],
    }
    workspace.spriteTables = [{
      schemaVersion: 1,
      id: 'ui',
      name: 'UI',
      textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 182, height: 14 } }],
      sprites: [{
        id: 'vertical-label',
        name: 'Vertical label',
        textureId: 'atlas',
        frame: { x: 0, y: 0, width: 14, height: 182 },
        rotation: 90,
        trimmed: false,
      }],
    }]
    workspace.openSprite('ui', 'vertical-label')

    expect(workspace.addFullSpriteTextRegion()).toBe(true)
    expect(workspace.selectedSpriteTranslation?.textRegions[0]).toMatchObject({
      rect: { x: 0, y: 0, width: 182, height: 14 },
      rotation: 0,
    })
    await workspace.saveProject()
  })

  it('uses the selected default background for newly enabled sprite translations', async () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    setWorkspaceProjectSessionForTesting({
      save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined),
    } as unknown as ProjectRepository)
    workspace.project = { schemaVersion: 3, name: 'Example' }
    workspace.spriteTables = [{
      schemaVersion: 1,
      id: 'ui',
      name: 'UI',
      textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 80, height: 32 } }],
      sprites: [{
        id: 'button',
        name: 'Button',
        textureId: 'atlas',
        frame: { x: 0, y: 0, width: 80, height: 32 },
        rotation: 0,
        trimmed: false,
      }],
    }]
    workspace.openSprite('ui', 'button')
    workspace.setDefaultTranslationBackground('blank')

    expect(workspace.setSpriteTranslationEnabled(true)).toBe(true)
    expect(workspace.selectedSpriteTranslation).toMatchObject({ backgroundType: 'blank' })
    await workspace.saveProject()
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

  it('imports loose PNG sprites into one table while preserving the source directory path', async () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    const files = new Map<string, string | Uint8Array>()
    const storage = {
      exists: vi.fn<(path: string) => Promise<boolean>>(async (path) => files.has(path)),
      writeBinary: vi.fn<(path: string, data: Uint8Array) => Promise<void>>(async (path, data) => {
        files.set(path, data)
      }),
      writeText: vi.fn<(path: string, text: string) => Promise<void>>(async (path, text) => {
        files.set(path, text)
      }),
      delete: vi.fn<(path: string) => Promise<void>>(async (path) => {
        files.delete(path)
      }),
    } as unknown as ProjectStorage
    const repository = {
      save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined),
    } as unknown as ProjectRepository
    setWorkspaceProjectSessionForTesting(repository, storage)
    workspace.project = { schemaVersion: 3, name: 'Example' }
    workspace.spriteTables = []
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:imported')
    vi.stubGlobal('createImageBitmap', vi.fn<(file: Blob) => Promise<ImageBitmap>>(async () => ({
      width: 96,
      height: 32,
      close: vi.fn<() => void>(),
    }) as unknown as ImageBitmap))
    const sourceFile = {
      name: 'BTN_DELETE_A.png',
      type: 'image/png',
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as File
    const sourceDirectory = {
      name: 'spr_ent_name',
      async *values() {
        yield {
          kind: 'file',
          name: 'BTN_DELETE_A.png',
          getFile: async () => sourceFile,
        } as unknown as FileSystemFileHandle
      },
    } as unknown as FileSystemDirectoryHandle
    vi.stubGlobal(
      'showDirectoryPicker',
      vi.fn<() => Promise<FileSystemDirectoryHandle>>(async () => sourceDirectory),
    )

    await expect(workspace.prepareLooseSpriteImport()).resolves.toEqual({
      directoryName: 'spr_ent_name',
      imageCount: 1,
    })
    await expect(workspace.importPreparedLooseSprites()).resolves.toBe(true)

    expect(storage.writeBinary).toHaveBeenCalledWith(
      'textures/spr_ent_name/BTN_DELETE_A.png',
      expect.any(Uint8Array),
    )
    expect(storage.writeText).toHaveBeenCalledWith(
      'manifests/spr_ent_name.sprite-table.json',
      expect.stringContaining('"imagePath": "spr_ent_name/BTN_DELETE_A.png"'),
    )
    expect(workspace.project?.spriteTableManifestPaths).toEqual([
      'manifests/spr_ent_name.sprite-table.json',
    ])
    expect(workspace.spriteTables[0]).toMatchObject({
      id: 'spr_ent_name',
      textures: [{ imagePath: 'spr_ent_name/BTN_DELETE_A.png' }],
      sprites: [{ id: 'BTN_DELETE_A', frame: { x: 0, y: 0, width: 96, height: 32 } }],
    })
  })
})
