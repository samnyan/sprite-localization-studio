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
        textRegions: [
          { id: 'first', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'first', translatedText: 'One' },
          { id: 'second', rect: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, translationKey: 'second', translatedText: 'Two' },
        ],
      }],
    }
    workspace.spriteTables = [spriteTable('ui', 'UI', 'start')]
    workspace.textureImageUrls = { ui: { page: 'blob:ui' } }
    workspace.selectSpriteTable('ui')
    const wrapper = mount(TranslationWorkspace, {
      attachTo: document.body,
      global: { plugins: [pinia, i18n], stubs: { TranslationSpritePreview: true, TextStyleEditorDialog: true, BackgroundEditorDialog: true } },
    })
    mountedWrapper = wrapper
    const inputs = wrapper.findAll('textarea[aria-label="Translation"]')

    await inputs[0]!.trigger('keydown', { altKey: true, key: 'ArrowDown' })
    await nextTick()

    expect(workspace.selectedTextRegionId).toBe('second')
    expect(document.activeElement).toBe(inputs[1]!.element)
    expect(inputs[0]!.attributes('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown')
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
    const statusFilter = wrapper.findComponent(Select)
    expect(statusFilter.exists()).toBe(true)
    expect(wrapper.get('[data-slot="select-trigger"]').attributes('aria-label')).toBe(
      'Translation status',
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
    const input = wrapper.get('textarea[aria-label="Translation"]')
    expect(document.activeElement).toBe(input.element)
    expect(input.classes()).toContain('ring-2')
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
