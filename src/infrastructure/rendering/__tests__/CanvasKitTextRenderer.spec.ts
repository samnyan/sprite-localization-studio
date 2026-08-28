import { describe, expect, it } from 'vitest'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import { isCanvasKitTextRenderSupported } from '@/infrastructure/rendering/CanvasKitTextRenderer'

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
})
