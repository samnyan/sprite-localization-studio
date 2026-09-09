import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { setWorkspaceProjectSessionForTesting, useWorkspaceStore } from '@/app/stores/workspace'
import type { ProjectRepository } from '@/application/project/ProjectRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'

afterEach(() => {
  setWorkspaceProjectSessionForTesting()
  vi.restoreAllMocks()
})

describe('workspace sprite translations', () => {
  it('batch-enables translations with full logical-size regions idempotently', () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      translations: [
        {
          spriteTableId: 'ui',
          spriteId: 'empty',
          textRegions: [],
        },
      ],
    }
    workspace.spriteTables = [
      {
        schemaVersion: 1,
        id: 'ui',
        name: 'UI',
        textures: [],
        sprites: [
          {
            id: 'new',
            name: 'New',
            textureId: 'atlas',
            frame: { x: 0, y: 0, width: 10, height: 12 },
            rotation: 0,
            trimmed: false,
          },
          {
            id: 'empty',
            name: 'Empty',
            textureId: 'atlas',
            frame: { x: 0, y: 0, width: 8, height: 9 },
            rotation: 0,
            trimmed: false,
          },
        ],
      },
    ]
    setWorkspaceProjectSessionForTesting(
      {
        save: vi.fn<(project: unknown) => Promise<void>>(async () => undefined),
      } as unknown as ProjectRepository,
      {} as ProjectStorage,
    )

    expect(workspace.batchEnableSpriteTranslations('ui', ['new', 'empty'])).toBe(true)

    const translations = workspace.project.translations ?? []
    expect(translations).toHaveLength(2)
    expect(translations.every((translation) => translation.textRegions)).toBe(true)
    expect(translations.map((translation) => translation.textRegions[0]?.rect)).toEqual([
      { x: 0, y: 0, width: 8, height: 9 },
      { x: 0, y: 0, width: 10, height: 12 },
    ])

    const regionIds = translations.map((translation) => translation.textRegions[0]?.id)
    expect(workspace.batchEnableSpriteTranslations('ui', ['new', 'empty'])).toBe(true)
    expect(
      (workspace.project.translations ?? []).map((translation) => translation.textRegions[0]?.id),
    ).toEqual(regionIds)
    expect(workspace.project.translations?.every((translation) => translation.textRegions)).toBe(
      true,
    )

    expect(workspace.setBatchSpriteTranslationsEnabled('ui', ['new', 'empty'], false)).toBe(true)
    expect(workspace.project.translations).toEqual([])
  })
})
