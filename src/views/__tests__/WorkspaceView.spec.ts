import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { toast } from 'vue-sonner'

import { i18n, setLocale } from '@/app/i18n'
import { useWorkspaceStore } from '@/app/stores/workspace'
import WorkspaceView from '@/views/WorkspaceView.vue'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn<() => void>() } }))

describe('WorkspaceView', () => {
  it('shows sprite tables grouped by texture and selected sprite metadata', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 3,
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

  it('shows workspace errors above every workspace mode', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = { schemaVersion: 3, name: 'Example' }
    workspace.mode = 'translations'
    workspace.status = 'error'
    workspace.error = { key: 'errors.build.blockedByTextDiagnostics' }

    const wrapper = mount(WorkspaceView, {
      global: { plugins: [pinia, i18n] },
    })

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Resolve translation issues before building textures.',
    )
    expect(wrapper.find('footer').text()).toContain('Action required')
  })

  it('uses the standard primary action styling for texture builds', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = { schemaVersion: 3, name: 'Example' }
    const wrapper = mount(WorkspaceView, { global: { plugins: [pinia, i18n] } })
    const buildButton = wrapper.get('[data-testid="build-textures"]')

    expect(buildButton.classes()).toContain('bg-primary')
    expect(buildButton.find('svg').attributes('data-icon')).toBe('inline-start')
  })

  it('shows build progress in the status bar and a spinner in the build action', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = { schemaVersion: 3, name: 'Example' }
    workspace.status = 'building'
    workspace.buildProgress = { completed: 1, total: 22 }
    const wrapper = mount(WorkspaceView, { global: { plugins: [pinia, i18n] } })

    expect(wrapper.find('footer').text()).toContain('Building textures 1/22…')
    expect(wrapper.get('[data-testid="build-textures"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[data-slot="progress"]').attributes('aria-label')).toBe(
      'Building textures 1/22…',
    )
  })

  it('notifies the output directory after a successful texture build', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = { schemaVersion: 3, name: 'Example' }
    vi.spyOn(workspace, 'buildTextures').mockResolvedValue(true)
    const wrapper = mount(WorkspaceView, { global: { plugins: [pinia, i18n] } })

    await wrapper.get('[data-testid="build-textures"]').trigger('click')
    await nextTick()

    expect(toast.success).toHaveBeenCalledWith('Texture build complete', {
      description: 'Output written to output_textures.',
    })
  })

  it('shows diagnostics for the selected text region in the sprite inspector', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      translations: [{
        spriteTableId: 'ui',
        spriteId: 'button-start',
        textRegions: [{
          id: 'title',
          rect: { x: 0, y: 0, width: 80, height: 20 },
          rotation: 0,
          translationKey: 'title',
        }],
      }, {
        spriteTableId: 'ui',
        spriteId: 'other-button',
        textRegions: [{
          id: 'title',
          rect: { x: 0, y: 0, width: 80, height: 20 },
          rotation: 0,
          translationKey: 'other-title',
        }],
      }],
    }
    workspace.spriteTables = [{
      schemaVersion: 1,
      id: 'ui',
      name: 'UI Table',
      textures: [{ id: 'page-00', imagePath: 'ui/page-00.png', size: { width: 100, height: 100 } }],
      sprites: [{
        id: 'button-start',
        name: 'button_start',
        textureId: 'page-00',
        frame: { x: 0, y: 0, width: 80, height: 20 },
        rotation: 0,
        trimmed: false,
      }],
    }]
    workspace.selectSprite('ui', 'button-start')
    workspace.selectTextRegion('title')

    const wrapper = mount(WorkspaceView, { global: { plugins: [pinia, i18n] } })

    expect(workspace.selectedTextDiagnostics).toEqual([
      { code: 'missingTranslation', spriteTableId: 'ui', spriteId: 'button-start', regionId: 'title' },
    ])
    expect(wrapper.get('[aria-label="1 translation issue"]').text()).toBe('Missing: title')
  })

  it('announces partial build results with their source texture identifiers', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = { schemaVersion: 3, name: 'Example' }
    workspace.status = 'error'
    workspace.error = { key: 'errors.build.partialFailure', params: { count: 1 } }
    const wrapper = mount(WorkspaceView, { global: { plugins: [pinia, i18n] } })
    const buildStatus = wrapper.get('[aria-label="Build result"]')

    expect(buildStatus.text()).toBe('')
    expect(buildStatus.attributes('role')).toBe('status')
    expect(buildStatus.attributes('aria-live')).toBe('polite')
    expect(buildStatus.attributes('aria-atomic')).toBe('true')
    expect(buildStatus.classes()).not.toContain('ml-3')

    workspace.lastBuildReport = {
      locale: 'zh-CN',
      textures: [],
      failures: [
        {
          spriteTableId: 'ui',
          textureId: 'atlas',
          texturePath: 'ui.png',
          spriteId: 'button',
          message: 'Source image could not be loaded.',
        },
      ],
      modifiedSpriteCount: 0,
      durationMs: 0,
    }
    await nextTick()

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Texture build failed (1 total). See details below.',
    )
    expect(wrapper.get('[aria-label="Build failures"]').text()).toContain(
      'ui / atlas (ui.png) / button: Source image could not be loaded.',
    )
    expect(wrapper.find('footer').text()).toContain('1 failed')
    expect(wrapper.find('footer').text()).toContain('0 ms')
    expect(buildStatus.text()).toContain('1 failed')
    expect(buildStatus.text()).toContain('0 ms')
    expect(buildStatus.classes()).toContain('ml-3')

    workspace.status = 'ready'
    await nextTick()

    expect(wrapper.get('[aria-label="Build result"]').element).toBe(buildStatus.element)
  })

  it('shows the most recent successful save time in the status bar', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = { schemaVersion: 3, name: 'Example' }
    workspace.lastSavedAt = new Date('2026-08-30T09:15:00.000Z')

    const wrapper = mount(WorkspaceView, {
      global: { plugins: [pinia, i18n] },
    })

    expect(wrapper.find('time').text()).toMatch(/^Saved /)
    expect(wrapper.get('time').attributes('datetime')).toBe('2026-08-30T09:15:00.000Z')
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('[role="status"]').attributes('aria-atomic')).toBe('true')
  })
})
