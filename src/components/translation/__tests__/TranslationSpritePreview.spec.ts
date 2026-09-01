import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import TranslationSpritePreview from '@/components/translation/TranslationSpritePreview.vue'

class ImageStub {
  naturalWidth = 14
  naturalHeight = 182
  onload?: () => void
  onerror?: () => void

  set src(_value: string) {
    this.onload?.()
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('TranslationSpritePreview', () => {
  it('rotates a single vertically oriented text region for the compact table preview', async () => {
    const context = {
      clearRect: vi.fn<() => void>(),
      drawImage: vi.fn<() => void>(),
      rotate: vi.fn<() => void>(),
      setTransform: vi.fn<() => void>(),
      translate: vi.fn<() => void>(),
    } as unknown as CanvasRenderingContext2D
    vi.stubGlobal('Image', ImageStub)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn<() => void>())
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)

    const wrapper = mount(TranslationSpritePreview, {
      props: {
        imageUrl: 'blob:source',
        textureSize: { width: 14, height: 182 },
        sprite: {
          id: 'vertical-label',
          name: 'Vertical label',
          textureId: 'texture',
          frame: { x: 0, y: 0, width: 14, height: 182 },
          rotation: 0,
          trimmed: false,
        },
        translation: {
          spriteTableId: 'table',
          spriteId: 'vertical-label',
          textRegions: [
            {
              id: 'label',
              rect: { x: -84, y: 84, width: 182, height: 14 },
              rotation: 90,
              translationKey: 'vertical-label.1',
            },
          ],
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('canvas').attributes()).toMatchObject({ width: '182', height: '14' })
    expect(context.translate).toHaveBeenCalledWith(0, 14)
    expect(context.rotate).toHaveBeenCalledWith(-Math.PI / 2)
  })
})
