import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import { i18n, setLocale } from '@/app/i18n'
import { setWorkspaceProjectSessionForTesting, useWorkspaceStore } from '@/app/stores/workspace'
import type { ProjectRepository } from '@/application/project/ProjectRepository'
import BackgroundEditorDialog from '@/components/translation/BackgroundEditorDialog.vue'
import TextStyleEditorDialog from '@/components/translation/TextStyleEditorDialog.vue'
import TranslationWorkspace from '@/components/translation/TranslationWorkspace.vue'
import { Select } from '@/components/ui/select'
import type { SpriteTable } from '@/domain/sprite-table/types'
import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'

let mountedWrapper: VueWrapper | undefined
let scrollIntoViewDescriptor: PropertyDescriptor | undefined

afterEach(() => {
  mountedWrapper?.unmount()
  mountedWrapper = undefined
  setWorkspaceProjectSessionForTesting()
  document.body.replaceChildren()
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
  scrollIntoViewDescriptor = undefined
})

describe('TranslationWorkspace', () => {
  it('opens original and output previews in the shared image overlay', async () => {
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
          spriteId: 'button',
          textRegions: [],
        },
      ],
    }
    workspace.spriteTables = [spriteTable('ui', 'UI', 'button')]
    workspace.textureImageUrls = { ui: { page: 'blob:ui' } }
    workspace.selectSpriteTable('ui')

    const wrapper = mount(TranslationWorkspace, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          TranslationSpritePreview: true,
          TextStyleEditorDialog: true,
          BackgroundEditorDialog: true,
          ImagePreviewDialog: {
            props: ['open', 'title', 'background', 'images', 'initialIndex', 'mode'],
            emits: ['close'],
            template:
              '<div v-if="open" data-testid="image-preview-overlay" :data-title="title" :data-background="background" :data-index="initialIndex" :data-mode="mode" :data-image-count="images.length"><slot /></div>',
          },
        },
      },
    })
    mountedWrapper = wrapper

    await wrapper.get('[data-testid="original-preview"]').trigger('click')
    expect(wrapper.get('[data-testid="image-preview-overlay"]').attributes('data-title')).toBe(
      'Original sprite',
    )
    expect(wrapper.get('[data-testid="image-preview-overlay"]').attributes('data-background')).toBe(
      'transparent',
    )
    expect(wrapper.get('[data-testid="image-preview-overlay"]').attributes()).toMatchObject({
      'data-index': '0',
      'data-mode': 'compare',
      'data-image-count': '2',
    })

    await wrapper.get('[data-testid="output-preview"]').trigger('click')
    expect(wrapper.get('[data-testid="image-preview-overlay"]').attributes('data-title')).toBe(
      'Output',
    )
    expect(wrapper.get('[data-testid="image-preview-overlay"]').attributes('data-index')).toBe('1')
  })

  it('navigates translated text inputs with Alt+Arrow keys', async () => {
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
          spriteId: 'start',
          backgroundType: 'template',
          backgroundId: 'missing-template',
          textRegions: [
            {
              id: 'first',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              translationKey: 'first',
              translatedText: 'One',
            },
            {
              id: 'second',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              translationKey: 'second',
              translatedText: 'Two',
            },
          ],
        },
      ],
    }
    workspace.spriteTables = [spriteTable('ui', 'UI', 'start')]
    workspace.textureImageUrls = { ui: { page: 'blob:ui' } }
    workspace.backgroundDiagnostics = [
      {
        resourceId: 'missing-template',
        path: 'sprite_base/template/missing.png',
        message: 'Not found',
      },
    ]
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
    const inputs = wrapper.findAll('textarea[aria-label="Translation"]')

    expect(workspace.selectedSpriteId).toBeUndefined()

    await inputs[0]!.trigger('keydown', { altKey: true, key: 'ArrowDown' })
    await nextTick()

    expect(workspace.selectedTextRegionId).toBe('second')
    expect(document.activeElement).toBe(inputs[1]!.element)
    expect(inputs[0]!.attributes('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown')
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'sprite_base/template/missing.png · Not found',
    )
  })

  it('filters translations by text and completion status', async () => {
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
    expect(
      (wrapper.get('textarea[aria-label="Translation"]').element as HTMLTextAreaElement).value,
    ).toBe('Ready')
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

    await statusFilter.vm.$emit('update:modelValue', 'incomplete')
    await filter.setValue('')
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
    expect(wrapper.text()).toContain('No translations match the filters.')
    await statusFilter.vm.$emit('update:modelValue', 'all')
  })

  it('does not render a top diagnostic list for an unavailable explicit project font', async () => {
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
          spriteId: 'start',
          textRegions: [
            {
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
            },
          ],
        },
      ],
    }
    workspace.spriteTables = [spriteTable('ui', 'UI', 'start')]
    workspace.textureImageUrls = { ui: { page: 'blob:ui' } }
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

    expect(wrapper.text()).not.toContain(
      'Project font unavailable (missing-font): UI / start / title',
    )
    expect(wrapper.find('[aria-label^="Go to translation issue"]').exists()).toBe(false)
  })

  it('copies template and custom styles from the previous translation row', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')
    const workspace = useWorkspaceStore()
    const templateRender = { ...DEFAULT_TEXT_RENDER, fontFamily: 'TemplateFont' }
    const customRender = { ...DEFAULT_TEXT_RENDER, fontFamily: 'CustomFont' }
    workspace.project = {
      schemaVersion: 3,
      name: 'Example',
      textStyleTemplates: [{ id: 'template-1', name: 'Headline', render: templateRender }],
      translations: ['first', 'second', 'third'].map((spriteId, index) => ({
        spriteTableId: 'ui',
        spriteId,
        textRegions: [
          {
            id: `region-${index}`,
            rect: { x: 0, y: 0, width: 1, height: 1 },
            rotation: 0,
            translationKey: `key-${index}`,
            ...(index === 0
              ? { styleId: 'template-1', render: templateRender }
              : index === 1
                ? { render: customRender }
                : { styleId: 'template-1', render: DEFAULT_TEXT_RENDER }),
          },
        ],
      })),
    }
    workspace.spriteTables = [
      {
        schemaVersion: 1,
        id: 'ui',
        name: 'UI',
        textures: [{ id: 'page', imagePath: 'ui.png', size: { width: 1, height: 1 } }],
        sprites: ['first', 'second', 'third'].map((id) => ({
          id,
          name: id,
          textureId: 'page',
          frame: { x: 0, y: 0, width: 1, height: 1 },
          rotation: 0 as const,
          trimmed: false,
        })),
      },
    ]
    workspace.textureImageUrls = { ui: { page: 'blob:ui' } }
    workspace.selectSpriteTable('ui')
    setWorkspaceProjectSessionForTesting({
      save: vi.fn<() => Promise<void>>().mockResolvedValue(),
    } as unknown as ProjectRepository)

    const wrapper = mount(TranslationWorkspace, {
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

    const copyButtons = wrapper.findAll('button[aria-label="Same as above"]')
    expect(copyButtons).toHaveLength(3)
    expect(copyButtons[0]!.attributes('disabled')).toBeDefined()

    await copyButtons[2]!.trigger('click')
    await copyButtons[1]!.trigger('click')

    expect(workspace.project?.translations?.[1]?.textRegions[0]).toMatchObject({
      styleId: 'template-1',
      render: templateRender,
    })
    expect(workspace.project?.translations?.[2]?.textRegions[0]).toMatchObject({
      styleId: undefined,
      render: customRender,
    })
  })

  it('supports single/combined filtering across tables, shows counts, handles duplicate sprite IDs, and clears filters properly', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setLocale('en')
    const workspace = useWorkspaceStore()
    const repository = {
      load: vi.fn<() => Promise<never>>(),
      save: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
      create: vi.fn<() => Promise<never>>(),
    } as unknown as ProjectRepository
    setWorkspaceProjectSessionForTesting(repository)
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
    expect(
      (wrapper.get('textarea[aria-label="Translation"]').element as HTMLTextAreaElement).value,
    ).toBe('HUD finished text')

    // Filter by search keyword within HUD Table
    const searchInput = wrapper.get('input[aria-label="Filter translations"]')
    await searchInput.setValue('NonExistent')
    expect(wrapper.text()).toContain('0 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(0)

    // Clear filters from empty state restores all 3 rows across tables
    const emptyStateClearButton = wrapper
      .findAll('button')
      .find((btn) => btn.text() === 'Clear filters')
    expect(emptyStateClearButton).toBeDefined()
    await emptyStateClearButton?.trigger('click')
    expect(wrapper.text()).toContain('3 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(3)

    // Filter by SpriteTable (UI Table) + status (incomplete)
    await tableSelect.vm.$emit('update:modelValue', 'ui')
    await statusSelect.vm.$emit('update:modelValue', 'incomplete')
    expect(wrapper.text()).toContain('1 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(
      (wrapper.get('textarea[aria-label="Translation"]').element as HTMLTextAreaElement).value,
    ).toBe('')

    // Clear filters button in header restores all rows
    const clearButton = wrapper.get('button[aria-label="Clear filters"]')
    await clearButton.trigger('click')
    expect(wrapper.text()).toContain('3 of 3 shown')
    expect(wrapper.findAll('article')).toHaveLength(3)

    // Edit text in HUD row when UI is the selectedSpriteTable
    expect(workspace.selectedSpriteTableId).toBe('ui')
    const hudInput = wrapper
      .findAll('textarea[aria-label="Translation"]')
      .find((input) => (input.element as HTMLTextAreaElement).value === 'HUD finished text')
    const hudArticle = hudInput?.element.closest('article')
    if (!hudInput || !hudArticle) throw new Error('Expected the HUD translation row.')
    await hudInput.setValue('Edited HUD text')

    const editButtons = wrapper
      .findAll('article')
      .find((article) => article.element === hudArticle)
      ?.findAll('button')
      .filter((button) => button.text() === 'Edit')
    if (!editButtons || editButtons.length !== 2) throw new Error('Expected HUD edit actions.')
    await editButtons[1]!.trigger('click')
    wrapper.findComponent(TextStyleEditorDialog).vm.$emit('save', {
      fontFamily: 'CustomFont',
      fontSize: 32,
      fontWeight: 700,
      color: '#ff0000',
      align: 'left',
    })
    await nextTick()

    await editButtons[0]!.trigger('click')
    wrapper.findComponent(BackgroundEditorDialog).vm.$emit('save', 'blank')
    await nextTick()

    // Assert only HUD translation changed, UI shared-id sprite was not modified
    const uiSharedTranslation = workspace.project?.translations?.find(
      (t) => t.spriteTableId === 'ui' && t.spriteId === 'shared-id',
    )
    const hudSharedTranslation = workspace.project?.translations?.find(
      (t) => t.spriteTableId === 'hud' && t.spriteId === 'shared-id',
    )
    expect(uiSharedTranslation?.textRegions[0]?.translatedText).toBe('Finished text')
    expect(hudSharedTranslation?.textRegions[0]?.translatedText).toBe('Edited HUD text')

    expect(uiSharedTranslation?.textRegions[0]?.render?.fontFamily).toBeUndefined()
    expect(hudSharedTranslation?.textRegions[0]?.render?.fontFamily).toBe('CustomFont')

    expect(uiSharedTranslation?.backgroundType).toBeUndefined()
    expect(hudSharedTranslation?.backgroundType).toBe('blank')
  })

  it('filters translation rows by the active texture directory', async () => {
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
          spriteId: 'common-sprite',
          textRegions: [
            {
              id: 'common-region',
              translationKey: 'common',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              sourceText: 'Common source',
            },
          ],
        },
        {
          spriteTableId: 'ui',
          spriteId: 'other-sprite',
          textRegions: [
            {
              id: 'other-region',
              translationKey: 'other',
              rect: { x: 0, y: 0, width: 1, height: 1 },
              rotation: 0,
              sourceText: 'Other source',
            },
          ],
        },
      ],
    }
    workspace.spriteTables = [
      {
        schemaVersion: 1,
        id: 'ui',
        name: 'UI',
        textures: [
          { id: 'common-page', imagePath: 'common/page.png', size: { width: 1, height: 1 } },
          { id: 'other-page', imagePath: 'other/page.png', size: { width: 1, height: 1 } },
        ],
        sprites: [
          {
            id: 'common-sprite',
            name: 'Common sprite',
            textureId: 'common-page',
            frame: { x: 0, y: 0, width: 1, height: 1 },
            rotation: 0,
            trimmed: false,
          },
          {
            id: 'other-sprite',
            name: 'Other sprite',
            textureId: 'other-page',
            frame: { x: 0, y: 0, width: 1, height: 1 },
            rotation: 0,
            trimmed: false,
          },
        ],
      },
    ]
    workspace.textureImageUrls = {
      ui: { 'common-page': 'blob:common', 'other-page': 'blob:other' },
    }
    workspace.selectSpriteTable('ui')
    workspace.selectTextureDirectory('common')

    const wrapper = mount(TranslationWorkspace, {
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

    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.text()).toContain('1 of 1 shown')
    expect((wrapper.findAll('textarea')[0]!.element as HTMLTextAreaElement).value).toBe(
      'Common source',
    )

    workspace.selectTextureDirectory('other')
    await nextTick()

    expect(wrapper.findAll('article')).toHaveLength(1)
    expect((wrapper.findAll('textarea')[0]!.element as HTMLTextAreaElement).value).toBe(
      'Other source',
    )
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
