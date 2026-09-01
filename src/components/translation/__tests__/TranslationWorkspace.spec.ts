import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import { i18n, setLocale } from '@/app/i18n'
import { useWorkspaceStore } from '@/app/stores/workspace'
import TranslationWorkspace from '@/components/translation/TranslationWorkspace.vue'
import { Select } from '@/components/ui/select'
import type { SpriteTable } from '@/domain/sprite-table/types'

let mountedWrapper: VueWrapper | undefined
let scrollIntoViewDescriptor: PropertyDescriptor | undefined

afterEach(() => {
  mountedWrapper?.unmount()
  mountedWrapper = undefined
  document.body.replaceChildren()
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
  scrollIntoViewDescriptor = undefined
})

describe('TranslationWorkspace', () => {
  it('navigates translated text inputs with Alt+Arrow keys', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')
    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      translations: [{
        spriteTableId: 'ui',
        spriteId: 'start',
        backgroundType: 'template',
        backgroundId: 'missing-template',
        textRegions: [
          { id: 'first', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'first', translatedText: 'One' },
          { id: 'second', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'second', translatedText: 'Two' },
        ],
      }],
    }
    workspace.spriteTables = [spriteTable('ui', 'UI', 'start')]
    workspace.textureImageUrls = { ui: { page: 'blob:ui' } }
    workspace.backgroundDiagnostics = [{
      resourceId: 'missing-template',
      path: 'sprite_base/template/missing.png',
      message: 'Not found',
    }]
    workspace.selectSpriteTable('ui')
    const wrapper = mount(TranslationWorkspace, {
      attachTo: document.body,
      global: { plugins: [pinia, i18n], stubs: { TranslationSpritePreview: true, TextStyleEditorDialog: true, BackgroundEditorDialog: true } },
    })
    mountedWrapper = wrapper
    const inputs = wrapper.findAll('textarea[aria-label="Translation"]')

    expect(workspace.selectedSpriteId).toBeUndefined()
    await wrapper.get('[aria-label="Go to translation issue: ui / start"]').trigger('click')
    await nextTick()
    expect(workspace.selectedSpriteId).toBe('start')

    await inputs[0]!.trigger('keydown', { altKey: true, key: 'ArrowDown' })
    await nextTick()

    expect(workspace.selectedTextRegionId).toBe('second')
    expect(document.activeElement).toBe(inputs[1]!.element)
    expect(inputs[0]!.attributes('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown')
    expect(wrapper.get('[role="alert"]').text()).toContain('sprite_base/template/missing.png · Not found')
  })

  it('navigates missing translations to their text region', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')

    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      translations: [
        {
          spriteTableId: 'first',
          spriteId: 'first-sprite',
          textRegions: [
            {
              id: 'first-region',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              translationKey: 'first',
              translatedText: 'Ready',
            },
          ],
        },
        {
          spriteTableId: 'second',
          spriteId: 'second-sprite',
          textRegions: [
            {
              id: 'second-region',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              translationKey: 'start',
            },
          ],
        },
      ],
    }
    workspace.spriteTables = [
      spriteTable('first', 'First', 'first-sprite'),
      spriteTable('second', 'Second', 'second-sprite'),
    ]
    workspace.textureImageUrls = {
      first: { page: 'blob:first' },
      second: { page: 'blob:second' },
    }
    workspace.selectSpriteTable('first')
    const scrollIntoView = vi.fn<() => void>()
    scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    )
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    const wrapper = mount(TranslationWorkspace, {
      attachTo: document.body,
      global: {
        plugins: [pinia, i18n],
        stubs: {
          TranslationSpritePreview: true,
          TextStyleEditorDialog: true,
          BackgroundEditorDialog: true,
        },
      },
    })
    mountedWrapper = wrapper

    const filter = wrapper.get('[data-slot="input"]')
    await filter.setValue('not-present')
    expect(wrapper.text()).toContain('No translations match the filters.')
    await filter.setValue('ready')
    expect((wrapper.get('textarea[aria-label="Translation"]').element as HTMLTextAreaElement).value).toBe(
      'Ready',
    )
    await filter.setValue('')
    const selects = wrapper.findAllComponents(Select)
    const statusFilter = selects[1]!
    expect(statusFilter.exists()).toBe(true)
    expect(wrapper.get('button[aria-label="Translation status"]').attributes('aria-label')).toBe(
      'Translation status',
    )
    expect(wrapper.get('button[aria-label="Sprite table"]').attributes('aria-label')).toBe(
      'Sprite table',
    )
    await statusFilter.vm.$emit('update:modelValue', 'complete')
    await filter.setValue('ready')
    await nextTick()

    const issue = wrapper.get(
      '[aria-label="Go to translation issue: Missing: Second / second-sprite / start"]',
    )
    expect(wrapper.text()).toContain('1 translation issue')
    expect(i18n.global.t('translation.issues', 2)).toBe('2 translation issues')

    await issue.trigger('click')
    await nextTick()

    expect(workspace.selectedSpriteTableId).toBe('second')
    expect(workspace.selectedSpriteId).toBe('second-sprite')
    expect(workspace.selectedTextRegionId).toBe('second-region')
    const inputs = wrapper.findAll('textarea[aria-label="Translation"]')
    const targetInput = inputs.find((i) => i.classes().includes('ring-2'))
    expect(targetInput).toBeDefined()
    expect(document.activeElement).toBe(targetInput!.element)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })

    await statusFilter.vm.$emit('update:modelValue', 'incomplete')
    await nextTick()
    expect(wrapper.get('textarea[aria-label="Translation"]')).toBeDefined()

    workspace.project = {
      ...workspace.project,
      translations: workspace.project.translations?.map((translation) =>
        translation.spriteTableId === 'second'
          ? {
              ...translation,
              textRegions: translation.textRegions.map((region) =>
                region.id === 'second-region' ? { ...region, translatedText: 'Start' } : region,
              ),
            }
          : translation,
      ),
    }
    await nextTick()
    expect(wrapper.find('[aria-label="Go to translation issue: Missing: Second / second-sprite / start"]').exists()).toBe(false)
    const completedInput = wrapper.get('textarea[aria-label="Translation"]')
    expect(completedInput).toBeDefined()
    await completedInput.trigger('blur')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()
    expect(wrapper.text()).toContain('No translations match the filters.')
    await statusFilter.vm.$emit('update:modelValue', 'all')

    expect(
      workspace.selectTextDiagnostic({
        code: 'missingTranslation',
        spriteTableId: 'missing',
        spriteId: 'missing',
        regionId: 'missing',
      }),
    ).toBe(false)
    expect(workspace.selectedSpriteTableId).toBe('second')
    expect(workspace.selectedSpriteId).toBe('second-sprite')
    expect(workspace.selectedTextRegionId).toBe('second-region')

    workspace.project = {
      ...workspace.project,
      translations: [
        {
          spriteTableId: 'second',
          spriteId: 'second-sprite',
          textRegions: Array.from({ length: 13 }, (_, index) => ({
            id: `issue-${index}`,
            rect: { x: 0, y: 0, width: 1, height: 1 },
            rotation: 0,
            translationKey: `issue-${index}`,
          })),
        },
      ],
    }
    await nextTick()
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(12)
    const showMore = wrapper.findAll('button').find((button) => button.text() === 'Show 1 more')
    expect(showMore).toBeDefined()
    await showMore?.trigger('click')
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(13)
  })

  it('shows a navigable diagnostic for an unavailable explicit project font', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')
    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      translations: [{
        spriteTableId: 'ui',
        spriteId: 'start',
        textRegions: [{
          id: 'title',
          rect: { x: 0, y: 0, width: 1, height: 1 },
          rotation: 0,
          translationKey: 'title',
          translatedText: 'Start',
          render: {
            fontFamily: 'Demo',
            fontId: 'missing-font',
            fontSize: 16,
            fontWeight: 400,
            color: '#fff',
            align: 'left',
          },
        }],
      }],
    }
    workspace.spriteTables = [spriteTable('ui', 'UI', 'start')]
    workspace.textureImageUrls = { ui: { page: 'blob:ui' } }
    workspace.selectSpriteTable('ui')
    const scrollIntoView = vi.fn<() => void>()
    scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    )
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    const wrapper = mount(TranslationWorkspace, {
      attachTo: document.body,
      global: {
        plugins: [pinia, i18n],
        stubs: {
          TranslationSpritePreview: true,
          TextStyleEditorDialog: true,
          BackgroundEditorDialog: true,
        },
      },
    })
    mountedWrapper = wrapper

    expect(wrapper.text()).toContain('Project font unavailable (missing-font): UI / start / title')
    await wrapper.get('[aria-label="Go to translation issue: Project font unavailable (missing-font): UI / start / title"]').trigger('click')
    expect(workspace.selectedTextRegionId).toBe('title')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })

  it('supports single/combined filtering across tables, shows counts, handles duplicate sprite IDs, and clears filters properly', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')
    const workspace = useWorkspaceStore()
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      translations: [
        {
          spriteTableId: 'ui',
          spriteId: 'shared-id',
          textRegions: [
            {
              id: 'r1',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              translationKey: 'key1',
              translatedText: 'Finished text',
            },
          ],
        },
        {
          spriteTableId: 'ui',
          spriteId: 'sprite-incomplete',
          textRegions: [
            {
              id: 'r2',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              translationKey: 'key2',
            },
          ],
        },
        {
          spriteTableId: 'hud',
          spriteId: 'shared-id',
          textRegions: [
            {
              id: 'r3',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              translationKey: 'key3',
              translatedText: 'HUD finished text',
            },
          ],
        },
      ],
    }
    workspace.spriteTables = [
      {
        schemaVersion: 1,
        id: 'ui',
        name: 'UI Table',
        textures: [{ id: 'page-ui', imagePath: 'ui.png', size: { width: 1, height: 1 } }],
        sprites: [
          {
            id: 'shared-id',
            name: 'UI Shared Sprite',
            textureId: 'page-ui',
            frame: { x: 0, y: 0, width: 1, height: 1 },
            rotation: 0,
            trimmed: false,
          },
          {
            id: 'sprite-incomplete',
            name: 'UI Incomplete Sprite',
            textureId: 'page-ui',
            frame: { x: 0, y: 0, width: 1, height: 1 },
            rotation: 0,
            trimmed: false,
          },
        ],
      },
      {
        schemaVersion: 1,
        id: 'hud',
        name: 'HUD Table',
        textures: [{ id: 'page-hud', imagePath: 'hud.png', size: { width: 1, height: 1 } }],
        sprites: [
          {
            id: 'shared-id',
            name: 'HUD Shared Sprite',
            textureId: 'page-hud',
            frame: { x: 0, y: 0, width: 1, height: 1 },
            rotation: 0,
            trimmed: false,
          },
        ],
      },
    ]
    workspace.textureImageUrls = {
      ui: { 'page-ui': 'blob:ui' },
      hud: { 'page-hud': 'blob:hud' },
    }
    workspace.selectSpriteTable('ui')

    const wrapper = mount(TranslationWorkspace, {
      attachTo: document.body,
      global: {
        plugins: [pinia, i18n],
        stubs: {
          TranslationSpritePreview: true,
          TextStyleEditorDialog: true,
          BackgroundEditorDialog: true,
        },
      },
    })
    mountedWrapper = wrapper

    // Shows all 3 rows by default (across UI Table and HUD Table)
    expect(wrapper.text()).toContain('3 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(3)

    // Filter by SpriteTable: HUD Table
    const selects = wrapper.findAllComponents(Select)
    const tableSelect = selects[0]!
    const statusSelect = selects[1]!

    await tableSelect.vm.$emit('update:modelValue', 'hud')
    expect(wrapper.text()).toContain('1 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect((wrapper.get('textarea[aria-label="Translation"]').element as HTMLTextAreaElement).value).toBe('HUD finished text')

    // Filter by search keyword within HUD Table
    const searchInput = wrapper.get('input[aria-label="Filter translations"]')
    await searchInput.setValue('NonExistent')
    expect(wrapper.text()).toContain('0 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(0)

    // Clear filters from empty state restores all 3 rows across tables
    const emptyStateClearButton = wrapper.findAll('button').find((btn) => btn.text() === 'Clear filters')
    expect(emptyStateClearButton).toBeDefined()
    await emptyStateClearButton?.trigger('click')
    expect(wrapper.text()).toContain('3 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(3)

    // Filter by SpriteTable (UI Table) + status (incomplete)
    await tableSelect.vm.$emit('update:modelValue', 'ui')
    await statusSelect.vm.$emit('update:modelValue', 'incomplete')
    expect(wrapper.text()).toContain('1 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect((wrapper.get('textarea[aria-label="Translation"]').element as HTMLTextAreaElement).value).toBe('')

    // Clear filters button in header restores all rows
    const clearButton = wrapper.get('button[aria-label="Clear filters"]')
    await clearButton.trigger('click')
    expect(wrapper.text()).toContain('3 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(3)
  })
})

function spriteTable(id: string, name: string, spriteId: string): SpriteTable {
  return {
    schemaVersion: 1 as const,
    id,
    name,
    textures: [
      {
        id: 'page',
        imagePath: `${id}.png`,
        size: { width: 1, height: 1 },
      },
    ],
    sprites: [
      {
        id: spriteId,
        name: spriteId,
        textureId: 'page',
        frame: { x: 0, y: 0, width: 1, height: 1 },
        rotation: 0,
        trimmed: false,
      },
    ],
  }
}
