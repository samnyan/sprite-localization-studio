import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

import { i18n, setLocale } from '@/app/i18n'
import { useWorkspaceStore } from '@/app/stores/workspace'
import WorkspaceView from '@/views/WorkspaceView.vue'

describe('WorkspaceView', () => {
  it('shows sprite tables grouped by texture and selected sprite metadata', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 2,
      name: 'Example',
      spriteTableManifestPaths: ['manifests/ui.sprite-table.json'],
      translations: [{ spriteTableId: 'ui', spriteId: 'button-start', textRegions: [] }],
    }
    workspace.spriteTables = [
      {
        schemaVersion: 1,
        id: 'ui',
        name: 'UI Table',
        textures: [
          {
            id: 'page-00',
            imagePath: 'ui/page-00.png',
            size: { width: 512, height: 512 },
          },
          {
            id: 'page-01',
            imagePath: 'ui/page-01.png',
            size: { width: 256, height: 256 },
          },
        ],
        sprites: [
          {
            id: 'button-start',
            name: 'button_start',
            textureId: 'page-01',
            frame: { x: 32, y: 64, width: 80, height: 160 },
            rotation: 90,
            trimmed: true,
            originalSize: { width: 180, height: 100 },
            trimOffset: { x: 20, y: 10 },
          },
          {
            id: 'button-back',
            name: 'button_back',
            textureId: 'page-00',
            frame: { x: 0, y: 0, width: 64, height: 32 },
            rotation: 0,
            trimmed: false,
          },
        ],
      },
    ]
    workspace.textureImageUrls = { ui: { 'page-00': 'blob:page-00', 'page-01': 'blob:page-01' } }
    workspace.selectSprite('ui', 'button-start')

    const wrapper = mount(WorkspaceView, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          SpritePreview: { template: '<div data-testid="sprite-preview"></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('UI Table')
    expect(wrapper.text()).toContain('page-01')
    expect(wrapper.text()).not.toContain('page-00')
    expect(wrapper.text()).toContain('button_start')
    const resourceItems = wrapper.findAll('aside button').map((button) => button.text())
    const markedSprite = wrapper
      .findAll('aside button')
      .find((button) => button.text() === 'button_start')
    expect(markedSprite?.classes()).toContain('font-semibold')
    expect(resourceItems.indexOf('button_start')).toBeLessThan(resourceItems.indexOf('button_back'))
    expect(wrapper.text()).toContain('90°')
    expect(wrapper.text()).toContain('180 × 100')
    expect(wrapper.find('[data-testid="sprite-preview"]').exists()).toBe(true)
  })
})
