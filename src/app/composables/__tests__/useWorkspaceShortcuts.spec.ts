import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

import { useWorkspaceShortcuts } from '@/app/composables/useWorkspaceShortcuts'
import { useWorkspaceStore } from '@/app/stores/workspace'

afterEach(() => window.getSelection()?.removeAllRanges())

describe('workspace shortcuts', () => {
  it('leaves native page-text copying alone before copying a selected text region', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
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
    const wrapper = mount({
      setup: () => useWorkspaceShortcuts(),
      template: '<span>copy this text</span>',
    }, { attachTo: document.body, global: { plugins: [pinia] } })
    const range = document.createRange()
    range.selectNodeContents(wrapper.get('span').element)
    window.getSelection()?.addRange(range)

    const nativeCopy = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true })
    window.dispatchEvent(nativeCopy)

    expect(nativeCopy.defaultPrevented).toBe(false)
    expect(workspace.canPasteTextRegion).toBe(false)

    window.getSelection()?.removeAllRanges()
    const regionCopy = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true })
    window.dispatchEvent(regionCopy)

    expect(regionCopy.defaultPrevented).toBe(true)
    expect(workspace.canPasteTextRegion).toBe(true)
    wrapper.unmount()
  })
})
