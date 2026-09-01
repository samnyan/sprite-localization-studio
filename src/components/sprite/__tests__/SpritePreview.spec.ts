import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import { i18n, setLocale } from '@/app/i18n'
import SpritePreview from '@/components/sprite/SpritePreview.vue'

class ImageStub {
  naturalWidth = 30
  naturalHeight = 30
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

describe('SpritePreview', () => {
  it('uses the configured background behind the canvas and keeps the size label outside it', async () => {
    setLocale('en')
    const context = {
      clearRect: vi.fn<() => void>(),
      drawImage: vi.fn<() => void>(),
      setTransform: vi.fn<() => void>(),
    } as unknown as CanvasRenderingContext2D
    vi.stubGlobal('Image', ImageStub)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)

    const wrapper = mount(SpritePreview, {
      props: {
        imageUrl: 'blob:source',
        textureSize: { width: 30, height: 30 },
        sprite: {
          id: 'button',
          name: 'Button',
          textureId: 'texture',
          frame: { x: 0, y: 0, width: 30, height: 30 },
          rotation: 0,
          trimmed: false,
        },
        previewBackground: 'white',
      },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const sizeLabel = wrapper.get('[data-testid="sprite-preview-size"]')

    expect(wrapper.find('.bg-white').exists()).toBe(true)
    expect(sizeLabel.text()).toBe('30 × 30')
    expect(sizeLabel.element.closest('.bg-white')).toBeNull()
  })
})
