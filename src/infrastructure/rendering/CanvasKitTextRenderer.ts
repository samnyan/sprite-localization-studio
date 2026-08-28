import type { Canvas, CanvasKit, Font, Paint, Shader } from 'canvaskit-wasm'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import type { TextPaint, TextRegion, TextRenderConfig } from '@/domain/text-region/types'
import { layoutText } from '@/domain/text-region/textLayout'
import { projectFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'
import { canvasKitTypefaceCache } from '@/infrastructure/rendering/CanvasKitTypefaceCache'

const genericFamilies = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'])

function isHexColor(value: string): boolean {
  return /^#[\da-f]{3,4}$|^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)
}

function colorFromHex(canvasKit: CanvasKit, value: string, alpha = 1): ReturnType<CanvasKit['Color4f']> {
  const hex = value.replace('#', '')
  const short = hex.length === 3 || hex.length === 4
  const channel = (index: number): number => {
    const part = short ? hex[index]! + hex[index]! : hex.slice(index * 2, index * 2 + 2)
    return Number.parseInt(part, 16) / 255
  }
  const sourceAlpha = hex.length === 4 ? channel(3) : hex.length === 8 ? channel(3) : 1
  return canvasKit.Color4f(channel(0), channel(1), channel(2), sourceAlpha * alpha)
}

function gradientStops(paint: TextPaint): { color: string; position: number; alpha?: number }[] {
  if (paint.gradientStops?.length) return [...paint.gradientStops].sort((left, right) => left.position - right.position)
  if (paint.gradientEnd) {
    return [
      { color: paint.color, position: 0, alpha: paint.alpha },
      { color: paint.gradientEnd, position: 1, alpha: paint.gradientEndAlpha ?? paint.alpha },
    ]
  }
  return []
}

function createPaint(
  canvasKit: CanvasKit,
  config: TextPaint | undefined,
  width: number,
  height: number,
  strokeWidth?: number,
): { paint: Paint; shader?: Shader } | undefined {
  const paint = new canvasKit.Paint()
  paint.setAntiAlias(true)
  const textPaint = config ?? { mode: 'solid' as const, color: '#ffffff', alpha: 1 }
  if (textPaint.mode === 'transparent') {
    paint.delete()
    return undefined
  }
  paint.setColor(colorFromHex(canvasKit, textPaint.color, textPaint.alpha))
  if (strokeWidth !== undefined) {
    paint.setStyle(canvasKit.PaintStyle.Stroke)
    paint.setStrokeWidth(strokeWidth)
  }
  if (textPaint.mode !== 'gradient') return { paint }

  const stops = gradientStops(textPaint)
  if (stops.length < 2) return { paint }
  const angle = ((textPaint.gradientAngle ?? 0) * Math.PI) / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const extent = Math.abs(dx) * width / 2 + Math.abs(dy) * height / 2
  const shader = canvasKit.Shader.MakeLinearGradient(
    [-dx * extent, -dy * extent],
    [dx * extent, dy * extent],
    stops.map((stop) => colorFromHex(canvasKit, stop.color, stop.alpha ?? 1)),
    stops.map((stop) => stop.position),
    canvasKit.TileMode.Clamp,
  )
  paint.setShader(shader)
  return { paint, shader }
}

function disposePaint(value: { paint: Paint; shader?: Shader } | undefined): void {
  if (!value) return
  value.shader?.delete()
  value.paint.delete()
}

function lineWidth(font: Font, text: string): number {
  const glyphs = font.getGlyphIDs(text)
  return font.getGlyphWidths(glyphs).reduce((total, width) => total + width, 0)
}

function spacedLineWidth(font: Font, text: string, letterSpacing: number): number {
  return lineWidth(font, text) + Math.max(0, Array.from(text).length - 1) * letterSpacing
}

function drawLine(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  paint: Paint,
  font: Font,
  letterSpacing: number,
): void {
  if (letterSpacing === 0) {
    canvas.drawText(text, x, y, paint, font)
    return
  }
  let cursor = x
  for (const character of Array.from(text)) {
    canvas.drawText(character, cursor, y, paint, font)
    cursor += lineWidth(font, character) + letterSpacing
  }
}

function resolveTypeface(canvasKit: CanvasKit, config: TextRenderConfig) {
  return canvasKitTypefaceCache.resolve(canvasKit, config)
}

function isSupportedPaint(paint: TextPaint | undefined): boolean {
  if (!paint || paint.mode === 'transparent') return true
  if (!isHexColor(paint.color)) return false
  return !paint.gradientStops?.some((stop) => !isHexColor(stop.color)) &&
    (!paint.gradientEnd || isHexColor(paint.gradientEnd))
}

export function isCanvasKitTextRenderSupported(render: TextRenderConfig): boolean {
  const config = { ...DEFAULT_TEXT_RENDER, ...render }
  const family = config.fontFamily.trim().toLowerCase()
  if (!genericFamilies.has(family) && !projectFontRegistry.findData(
    config.fontFamily,
    config.fontWeight,
    config.fontStyle ?? 'normal',
  )) {
    return false
  }
  if (
    config.stroke?.position === 'inside' ||
    !isSupportedPaint(config.fill ?? { mode: 'solid', color: config.color }) ||
    !isSupportedPaint(config.stroke?.paint)
  ) {
    return false
  }
  const shadows = config.shadows ?? (config.shadow ? [config.shadow] : [])
  if (shadows.some((shadow) => (shadow.alpha ?? 1) > 0 && !isHexColor(shadow.color))) return false
  return (config.layers ?? []).every((layer) => !layer.enabled || isCanvasKitTextRenderSupported(layer.render))
}

export function areCanvasKitTextRegionsSupported(regions: TextRegion[]): boolean {
  return regions.every((region) => !region.translatedText?.trim() || isCanvasKitTextRenderSupported(
    region.render ?? DEFAULT_TEXT_RENDER,
  ))
}

function drawTextRegionCore(
  canvasKit: CanvasKit,
  canvas: Canvas,
  text: string,
  region: TextRegion,
  render: TextRenderConfig,
): void {
  const config = { ...DEFAULT_TEXT_RENDER, ...render }
  let typeface: ReturnType<typeof resolveTypeface> | undefined
  let font: Font | undefined
  let fill: ReturnType<typeof createPaint>
  let stroke: ReturnType<typeof createPaint>
  let saved = false

  try {
    typeface = resolveTypeface(canvasKit, config)
    if (!typeface) throw new Error('CanvasKit could not create the requested typeface.')
    font = new canvasKit.Font(typeface, config.fontSize)
    const activeFont = font
    fill = createPaint(
      canvasKit,
      config.fill ?? { mode: 'solid', color: config.color },
      region.rect.width,
      region.rect.height,
    )
    stroke =
      config.stroke && config.stroke.width > 0
        ? createPaint(canvasKit, config.stroke.paint, region.rect.width, region.rect.height, config.stroke.width * 2)
        : undefined
    canvas.save()
    saved = true
    canvas.translate(region.rect.x + region.rect.width / 2, region.rect.y + region.rect.height / 2)
    canvas.rotate(region.rotation, 0, 0)
    const layout = layoutText(
      text,
      region.rect.width,
      region.rect.height,
      config,
      (line, fontSize) => {
        activeFont.setSize(fontSize)
        return lineWidth(activeFont, line)
      },
    )
    activeFont.setSize(layout.fontSize)
    if (config.overflow !== 'visible') {
      canvas.clipRect(
        canvasKit.LTRBRect(-region.rect.width / 2, -region.rect.height / 2, region.rect.width / 2, region.rect.height / 2),
        canvasKit.ClipOp.Intersect,
        true,
      )
    }
    const startY = config.verticalAlign === 'top'
      ? -region.rect.height / 2 + layout.lineHeight / 2
      : config.verticalAlign === 'bottom'
        ? region.rect.height / 2 - layout.height + layout.lineHeight / 2
        : -layout.height / 2 + layout.lineHeight / 2
    const metrics = activeFont.getMetrics()
    const baselineOffset = -(metrics.ascent + metrics.descent) / 2
    const letterSpacing = config.letterSpacing ?? 0
    const shadows = config.shadows ?? (config.shadow ? [config.shadow] : [])
    for (const [index, line] of layout.lines.entries()) {
      const width = spacedLineWidth(activeFont, line, letterSpacing)
      const x = config.align === 'left' ? -region.rect.width / 2 : config.align === 'right' ? region.rect.width / 2 - width : -width / 2
      const baseline = startY + index * layout.lineHeight + baselineOffset
      for (const shadow of shadows) {
        if ((shadow.alpha ?? 1) <= 0) continue
        const shadowPaint = createPaint(
          canvasKit,
          { mode: 'solid', color: shadow.color, alpha: shadow.alpha ?? 1 },
          region.rect.width,
          region.rect.height,
        )
        if (!shadowPaint) continue
        const filter = shadow.blur > 0
          ? canvasKit.MaskFilter.MakeBlur(canvasKit.BlurStyle.Normal, shadow.blur, true)
          : undefined
        try {
          if (filter) shadowPaint.paint.setMaskFilter(filter)
          drawLine(
            canvas,
            line,
            x + shadow.offsetX,
            baseline + shadow.offsetY,
            shadowPaint.paint,
            activeFont,
            letterSpacing,
          )
        } finally {
          filter?.delete()
          disposePaint(shadowPaint)
        }
      }
      if (stroke) drawLine(canvas, line, x, baseline, stroke.paint, activeFont, letterSpacing)
      if (fill) drawLine(canvas, line, x, baseline, fill.paint, activeFont, letterSpacing)
    }
  } finally {
    if (saved) canvas.restore()
    disposePaint(fill)
    disposePaint(stroke)
    font?.delete()
  }
}

export function drawTextRegionWithCanvasKit(
  canvasKit: CanvasKit,
  canvas: Canvas,
  text: string,
  region: TextRegion,
  render: TextRenderConfig,
): void {
  for (const layer of render.layers ?? []) {
    if (layer.enabled) drawTextRegionWithCanvasKit(canvasKit, canvas, text, region, layer.render)
  }
  drawTextRegionCore(canvasKit, canvas, text, region, render)
}

export function drawTranslationTextWithCanvasKit(
  canvasKit: CanvasKit,
  canvas: Canvas,
  regions: TextRegion[],
): void {
  for (const region of regions) {
    const text = region.translatedText?.trim()
    if (text) drawTextRegionWithCanvasKit(canvasKit, canvas, text, region, region.render ?? DEFAULT_TEXT_RENDER)
  }
}
