import { planTextRun } from '@/domain/text-region/textLayout'
import type { TextMeasureForRender } from '@/application/qa/TextLayoutDiagnostics'

export function createCanvasTextMeasure(): TextMeasureForRender | undefined {
  if (typeof document === 'undefined' || typeof CanvasRenderingContext2D === 'undefined') return undefined
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return undefined
  return (text, fontSize, render) => {
    context.font = `${render.fontStyle ?? 'normal'} ${render.fontWeight} ${fontSize}px ${render.fontFamily}`
    return planTextRun(text, render.letterSpacing ?? 0, (unit) => context.measureText(unit).width).width
  }
}
