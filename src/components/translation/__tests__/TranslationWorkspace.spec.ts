import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import { i18n, setLocale } from '@/app/i18n'
import { useWorkspaceStore } from '@/app/stores/workspace'
import TranslationWorkspace from '@/components/translation/TranslationWorkspace.vue'
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

    const issue = wrapper.get(
      '[aria-label="Go to translation issue: Second / second-sprite / start"]',
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
    expect(wrapper.find('[aria-label="Go to translation issue: Second / second-sprite / start"]').exists()).toBe(false)

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
