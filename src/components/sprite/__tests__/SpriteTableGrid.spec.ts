import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'

import { i18n, setLocale } from '@/app/i18n'
import SpriteTableGrid from '@/components/sprite/SpriteTableGrid.vue'

const sprites = Array.from({ length: 100 }, (_, index) => ({
  id: `sprite-${index}`,
  name: `Sprite ${index}`,
  textureId: 'atlas',
  frame: { x: index, y: 0, width: 16, height: 16 },
  rotation: 0 as const,
  trimmed: false,
}))

describe('SpriteTableGrid', () => {
  afterEach(() => vi.restoreAllMocks())

  it('virtualizes Sprite cells and emits distinct select and open actions', async () => {
    setLocale('en')
    const wrapper = mount(SpriteTableGrid, {
      props: {
        spriteTable: {
          schemaVersion: 1,
          id: 'ui',
          name: 'UI',
          textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 100, height: 100 } }],
          sprites,
        },
        textureUrls: {},
        previewBackground: 'black',
      },
      global: { plugins: [i18n], stubs: { Slider: true } },
    })

    const cells = wrapper.findAll('[data-testid="sprite-grid-item"]')
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.length).toBeLessThan(sprites.length)
    expect(cells[0]!.find('canvas').classes()).toContain('[image-rendering:auto]')
    expect(cells[0]!.get('[data-testid="sprite-grid-preview-background"]').classes()).toContain(
      'bg-black',
    )

    await wrapper.setProps({
      spriteTable: {
        schemaVersion: 1,
        id: 'ui',
        name: 'UI',
        textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 100, height: 100 } }],
        sprites: [{ ...sprites[0]!, name: 'common/Texture/TestMode/0' }, ...sprites.slice(1)],
      },
    })
    expect(
      wrapper
        .get('[data-testid="sprite-grid-item"] span[title="common/Texture/TestMode/0"]')
        .text(),
    ).toBe('0')

    await cells[0]!.trigger('click')
    await cells[1]!.trigger('click', { ctrlKey: true })
    await cells[2]!.trigger('click', { shiftKey: true })
    await cells[0]!.trigger('dblclick')

    expect(wrapper.emitted('select')).toEqual([
      ['sprite-0', { ctrlKey: false, metaKey: false, shiftKey: false }],
      ['sprite-1', { ctrlKey: true, metaKey: false, shiftKey: false }],
      ['sprite-2', { ctrlKey: false, metaKey: false, shiftKey: true }],
    ])
    expect(wrapper.emitted('open')).toEqual([['sprite-0']])
  })

  it('redraws canvases when scrolling mounts a new virtual range', async () => {
    const context = {
      setTransform: vi.fn<(...args: unknown[]) => void>(),
      clearRect: vi.fn<(...args: unknown[]) => void>(),
      save: vi.fn<(...args: unknown[]) => void>(),
      translate: vi.fn<(...args: unknown[]) => void>(),
      scale: vi.fn<(...args: unknown[]) => void>(),
      transform: vi.fn<(...args: unknown[]) => void>(),
      drawImage: vi.fn<(...args: unknown[]) => void>(),
      restore: vi.fn<(...args: unknown[]) => void>(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    class FakeImage {
      onload?: () => void
      onerror?: () => void
      set src(_value: string) {
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', FakeImage)

    const wrapper = mount(SpriteTableGrid, {
      props: {
        spriteTable: {
          schemaVersion: 1,
          id: 'ui',
          name: 'UI',
          textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 100, height: 100 } }],
          sprites,
        },
        textureUrls: { atlas: 'blob:atlas' },
        previewBackground: 'black',
      },
      global: { plugins: [i18n], stubs: { Slider: true } },
    })

    await flushPromises()
    const initialDrawCount = context.drawImage.mock.calls.length
    const viewport = wrapper.get('[data-testid="sprite-grid-viewport"]')
    Object.defineProperty(viewport.element, 'scrollTop', { value: 1000, writable: true })
    await viewport.trigger('scroll')
    await flushPromises()

    expect(context.drawImage.mock.calls.length).toBeGreaterThan(initialDrawCount)
  })

  it('emits selection actions without replacing the inspector selection', async () => {
    setLocale('en')
    const wrapper = mount(SpriteTableGrid, {
      props: {
        spriteTable: {
          schemaVersion: 1,
          id: 'ui',
          name: 'UI',
          textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 100, height: 100 } }],
          sprites,
        },
        textureUrls: {},
        selectedSpriteId: 'sprite-0',
        selectedSpriteIds: new Set(['sprite-1']),
      },
      global: { plugins: [i18n], stubs: { Slider: true } },
    })

    await wrapper.get('[data-testid="sprite-grid-selection"]').trigger('change')
    expect(wrapper.emitted('toggleSelection')).toEqual([['sprite-0']])
    expect(wrapper.get('[data-testid="sprite-grid-item"]').attributes('aria-pressed')).toBe('true')

    const batchButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Mark for translation'))
    expect(batchButton).toBeDefined()
    await batchButton!.trigger('click')
    expect(wrapper.emitted('batchTranslate')).toEqual([[]])

    const clearButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Clear selection'))
    expect(clearButton).toBeDefined()
    await clearButton!.trigger('click')
    expect(wrapper.emitted('clearSelection')).toEqual([[]])
  })
})
