import type { Canvas, CanvasKit, Font, Paint, Shader } from 'canvaskit-wasm'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import type { TextPaint, TextRegion, TextRenderConfig } from '@/domain/text-region/types'
import { projectFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'

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

function resolveTypeface(canvasKit: CanvasKit, config: TextRenderConfig) {
  const data = projectFontRegistry.findData(
    config.fontFamily,
    config.fontWeight,
    config.fontStyle ?? 'normal',
  )
  return data ? canvasKit.Typeface.MakeTypefaceFromData(data) : canvasKit.Typeface.GetDefault()
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
    const lines = text.split(/\r?\n/)
    const lineHeight = config.fontSize * (config.lineHeight ?? 1.2)
    const startY = -((lines.length - 1) * lineHeight) / 2
    const shadows = config.shadows ?? (config.shadow ? [config.shadow] : [])
    for (const [index, line] of lines.entries()) {
      const width = lineWidth(font, line)
      const x = config.align === 'left' ? -region.rect.width / 2 : config.align === 'right' ? region.rect.width / 2 - width : -width / 2
      const baseline = startY + index * lineHeight + config.fontSize * 0.35
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
          canvas.drawText(line, x + shadow.offsetX, baseline + shadow.offsetY, shadowPaint.paint, font)
        } finally {
          filter?.delete()
          disposePaint(shadowPaint)
        }
      }
      if (stroke) canvas.drawText(line, x, baseline, stroke.paint, font)
      if (fill) canvas.drawText(line, x, baseline, fill.paint, font)
    }
  } finally {
    if (saved) canvas.restore()
    disposePaint(fill)
    disposePaint(stroke)
    font?.delete()
    typeface?.delete()
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
