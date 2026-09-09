import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useWorkspaceStore } from '@/app/stores/workspace'

describe('workspace selection', () => {
  it('keeps the active texture directory when selecting a sprite in the same table', () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    workspace.spriteTables = [
      {
        schemaVersion: 1,
        id: 'ui',
        name: 'UI',
        textures: [],
        sprites: [
          {
            id: 'button',
            name: 'Button',
            textureId: 'atlas',
            frame: { x: 0, y: 0, width: 8, height: 8 },
            rotation: 0,
            trimmed: false,
          },
        ],
      },
      {
        schemaVersion: 1,
        id: 'hud',
        name: 'HUD',
        textures: [],
        sprites: [
          {
            id: 'status',
            name: 'Status',
            textureId: 'atlas',
            frame: { x: 0, y: 0, width: 8, height: 8 },
            rotation: 0,
            trimmed: false,
          },
        ],
      },
    ]
    workspace.selectedSpriteTableId = 'ui'
    workspace.selectedTextureDirectory = 'common/Texture'

    workspace.selectSprite('ui', 'button')
    expect(workspace.selectedTextureDirectory).toBe('common/Texture')

    workspace.selectSprite('hud', 'status')
    expect(workspace.selectedTextureDirectory).toBeUndefined()
  })
})
