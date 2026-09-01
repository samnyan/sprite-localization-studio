import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useWorkspaceStore } from '@/app/stores/workspace'

describe('text region clipboard state', () => {
  it('enables paste after copying the selected region without changing the document', () => {
    setActivePinia(createPinia())
    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      translations: [{
        spriteTableId: 'ui',
        spriteId: 'button',
        textRegions: [{
          id: 'title',
          translationKey: 'ui.button.title',
          rect: { x: 0, y: 0, width: 20, height: 10 },
          rotation: 0,
        }],
      }],
    }
    workspace.spriteTables = [{
      schemaVersion: 1,
      id: 'ui',
      name: 'UI',
      textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 64, height: 64 } }],
      sprites: [{
        id: 'button',
        name: 'Button',
        textureId: 'atlas',
        frame: { x: 0, y: 0, width: 64, height: 64 },
        rotation: 0,
        trimmed: false,
      }],
    }]
    workspace.selectSprite('ui', 'button')
    workspace.selectTextRegion('title')

    expect(workspace.canPasteTextRegion).toBe(false)
    expect(workspace.copyTextRegion()).toBe(true)
    expect(workspace.canPasteTextRegion).toBe(true)
    expect(workspace.isDirty).toBe(false)
  })
})
