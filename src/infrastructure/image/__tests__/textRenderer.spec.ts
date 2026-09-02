import { describe, expect, it, vi } from 'vitest'

import type { TextRegion } from '@/domain/text-region/types'
import { drawTextRegion } from '@/infrastructure/image/textRenderer'

function createContext() {
  const measureText = vi.fn<(text: string) => TextMetrics>((text) => ({ width: text.length * 10 }) as TextMetrics)
  const fillText = vi.fn<(text: string, x: number, y: number) => void>()
  const strokeText = vi.fn<(text: string, x: number, y: number) => void>()
  const context = {
    beginPath: () => undefined,
    clip: () => undefined,
    fillText,
    lineJoin: 'miter' as CanvasLineJoin,
    measureText,
    rect: () => undefined,
    restore: () => undefined,
    rotate: () => undefined,
    save: () => undefined,
    strokeText,
    translate: () => undefined,
  }
  return {
    context: context as unknown as CanvasRenderingContext2D,
    fillText,
    measureText,
    strokeText,
  }
}

const region: TextRegion = {
  id: 'title',
  rect: { x: 0, y: 0, width: 200, height: 80 },
  rotation: 0,
  translationKey: 'title',
}

describe('drawTextRegion', () => {
  it('reuses the final line plan across shadow, stroke, and fill', () => {
    const { context, measureText } = createContext()

    drawTextRegion(context, 'AB', region, {
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 700,
      color: '#ffffff',
      align: 'center',
      letterSpacing: 2,
      wrap: false,
      overflow: 'visible',
      shadows: [{ color: '#000000', alpha: 1, blur: 2, offsetX: 1, offsetY: 1 }],
      stroke: { width: 1, position: 'outside', paint: { mode: 'solid', color: '#000000' } },
    })

    expect(measureText).toHaveBeenCalledTimes(5)
    expect((context as unknown as { lineJoin: CanvasLineJoin }).lineJoin).toBe('round')
  })

  it('applies the configured outline join', () => {
    const { context } = createContext()

    drawTextRegion(context, 'AB', region, {
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 700,
      color: '#ffffff',
      align: 'center',
      stroke: {
        width: 1,
        position: 'outside',
        join: 'bevel',
        paint: { mode: 'solid', color: '#000000' },
      },
    })

    expect((context as unknown as { lineJoin: CanvasLineJoin }).lineJoin).toBe('bevel')
  })

  it('keeps native whole-run drawing when letter spacing is disabled', () => {
    const { context, fillText, measureText, strokeText } = createContext()

    drawTextRegion(context, 'AB', region, {
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 700,
      color: '#ffffff',
      align: 'center',
      letterSpacing: 0,
      wrap: false,
      overflow: 'visible',
      shadow: undefined,
    })

    expect(measureText).toHaveBeenCalledTimes(2)
    expect(fillText).toHaveBeenCalledExactlyOnceWith('AB', 0, 0)
    expect(strokeText).toHaveBeenCalledExactlyOnceWith('AB', 0, 0)
  })
})
