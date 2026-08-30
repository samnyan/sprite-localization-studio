import { describe, expect, it } from 'vitest'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import {
  areCanvasKitTextRegionsSupported,
  drawTextRegionWithCanvasKit,
  isCanvasKitTextRegionSupported,
  isCanvasKitTextRenderSupported,
} from '@/infrastructure/rendering/CanvasKitTextRenderer'

describe('isCanvasKitTextRenderSupported', () => {
  it('keeps the generic default style on the CanvasKit path', () => {
    expect(isCanvasKitTextRenderSupported(DEFAULT_TEXT_RENDER)).toBe(true)
  })

  it('falls back when a system font has no project font binary', () => {
    expect(isCanvasKitTextRenderSupported({ ...DEFAULT_TEXT_RENDER, fontFamily: 'Arial' })).toBe(false)
  })

  it('falls back for styles that require Canvas 2D parity', () => {
    expect(isCanvasKitTextRenderSupported({
      ...DEFAULT_TEXT_RENDER,
      stroke: { width: 2, position: 'inside', paint: { mode: 'solid', color: '#000000' } },
    })).toBe(false)
    expect(isCanvasKitTextRenderSupported({
      ...DEFAULT_TEXT_RENDER,
      fill: { mode: 'solid', color: 'red' },
    })).toBe(false)
  })

  it('keeps complex scripts off the simple CanvasKit text path', () => {
    expect(isCanvasKitTextRegionSupported('مرحبا بالعالم', DEFAULT_TEXT_RENDER)).toBe(false)
    expect(isCanvasKitTextRegionSupported('Hello world', DEFAULT_TEXT_RENDER)).toBe(true)
  })

  it('rejects the whole region set before CanvasKit drawing starts', () => {
    const region = {
      id: 'title',
      rect: { x: 0, y: 0, width: 200, height: 80 },
      rotation: 0,
      translationKey: 'title',
      translatedText: 'مرحبا بالعالم',
    }

    expect(areCanvasKitTextRegionsSupported([region])).toBe(false)
    expect(() => drawTextRegionWithCanvasKit(
      {} as never,
      {} as never,
      region.translatedText,
      region,
      DEFAULT_TEXT_RENDER,
    )).toThrow('CanvasKit text region is unsupported.')
  })
})
