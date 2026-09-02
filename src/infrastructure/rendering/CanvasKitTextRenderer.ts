import type {
  Canvas,
  CanvasKit,
  Font,
  Paint,
  Paragraph,
  ParagraphBuilder,
  Shader,
  TypefaceFontProvider,
} from 'canvaskit-wasm'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import type { TextPaint, TextRegion, TextRenderConfig } from '@/domain/text-region/types'
import { layoutText, planTextRun, type TextRunPlan } from '@/domain/text-region/textLayout'
import {
  alignTextBlockBounds,
  layoutTextBaselines,
  type TextLineVerticalBounds,
} from '@/domain/text-region/textVerticalLayout'
import { requiresComplexTextShaping } from '@/domain/text-region/textScript'
import { projectFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'
import { canvasKitTypefaceCache } from '@/infrastructure/rendering/CanvasKitTypefaceCache'

const genericFamilies = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'])
const rtlLetter = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}]/u
const ltrParagraphLetter = /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Thai}\p{Script=Lao}\p{Script=Tibetan}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Mongolian}\p{Script=Javanese}\p{Script=Balinese}]/u
const letter = /\p{L}/u

export class CanvasKitTextFallbackError extends Error {}

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

function hasUnresolvedGlyphs(font: Font, text: string): boolean {
  return font.getGlyphIDs(text).some((glyph) => glyph === 0)
}

function spacedLineWidth(font: Font, text: string, letterSpacing: number): number {
  return planTextRun(text, letterSpacing, (unit) => lineWidth(font, unit)).width
}

function canvasKitLineBounds(
  font: Font,
  text: string,
  fontSize: number,
  outsideStroke: number,
): TextLineVerticalBounds {
  const glyphs = font.getGlyphIDs(text || 'Mg')
  const bounds = (font as Partial<Font>).getGlyphBounds?.(glyphs)
  if (bounds?.length) {
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (let index = 0; index < bounds.length; index += 4) {
      top = Math.min(top, bounds[index + 1] ?? top)
      bottom = Math.max(bottom, bounds[index + 3] ?? bottom)
    }
    if (Number.isFinite(top) && Number.isFinite(bottom)) {
      return {
        ascent: Math.max(0, -top) + outsideStroke,
        descent: Math.max(0, bottom) + outsideStroke,
      }
    }
  }
  const metrics = font.getMetrics()
  return {
    ascent: Math.max(0, -metrics.ascent || fontSize * 0.8) + outsideStroke,
    descent: Math.max(0, metrics.descent || fontSize * 0.2) + outsideStroke,
  }
}

function drawLine(
  canvas: Canvas,
  plan: TextRunPlan,
  x: number,
  y: number,
  paint: Paint,
  font: Font,
): void {
  if (plan.units.length === 1) {
    canvas.drawText(plan.units[0]!, x, y, paint, font)
    return
  }
  let cursor = x
  for (const [index, character] of plan.units.entries()) {
    canvas.drawText(character, cursor, y, paint, font)
    cursor += plan.advances[index] ?? 0
  }
}

function resolveTypeface(canvasKit: CanvasKit, config: TextRenderConfig) {
  return canvasKitTypefaceCache.resolve(canvasKit, config)
}

function findProjectFontData(config: TextRenderConfig): ArrayBuffer | undefined {
  return config.fontId
    ? projectFontRegistry.findDataById(config.fontId)
    : projectFontRegistry.findData(config.fontFamily, config.fontWeight, config.fontStyle ?? 'normal')
}

function isSupportedPaint(paint: TextPaint | undefined): boolean {
  if (!paint || paint.mode === 'transparent') return true
  if (!isHexColor(paint.color)) return false
  return !paint.gradientStops?.some((stop) => !isHexColor(stop.color)) &&
    (!paint.gradientEnd || isHexColor(paint.gradientEnd))
}

function activeShadows(config: TextRenderConfig) {
  return (config.shadows ?? (config.shadow ? [config.shadow] : [])).filter(
    (shadow) => (shadow.alpha ?? 1) > 0,
  )
}

function hasEnabledLayers(config: TextRenderConfig): boolean {
  return config.layers?.some((layer) => layer.enabled) ?? false
}

function paragraphDirection(text: string, canvasKit: CanvasKit) {
  for (const character of text) {
    if (!letter.test(character)) continue
    return rtlLetter.test(character) ? canvasKit.TextDirection.RTL : canvasKit.TextDirection.LTR
  }
  return canvasKit.TextDirection.LTR
}

function hasKnownParagraphDirection(text: string): boolean {
  for (const character of text) {
    if (letter.test(character) && requiresComplexTextShaping(character) &&
      !rtlLetter.test(character) && !ltrParagraphLetter.test(character)) return false
  }
  return true
}

function paragraphMaxLines(region: TextRegion, config: TextRenderConfig): number | undefined {
  if (config.overflow === 'visible') return config.maxLines
  const capacity = Math.floor(region.rect.height / (config.fontSize * (config.lineHeight ?? 1.2)))
  if (capacity < 1) return undefined
  return Math.min(config.maxLines ?? Number.POSITIVE_INFINITY, capacity)
}

function isCanvasKitParagraphSupported(text: string, render: TextRenderConfig): boolean {
  const config = { ...DEFAULT_TEXT_RENDER, ...render }
  const fill = config.fill ?? { mode: 'solid', color: config.color }
  return requiresComplexTextShaping(text) &&
    config.wrap === true &&
    !config.autoFit &&
    hasKnownParagraphDirection(text) &&
    fill.mode === 'solid' &&
    isHexColor(fill.color) &&
    !(config.stroke && config.stroke.width > 0) &&
    activeShadows(config).length === 0 &&
    !hasEnabledLayers(config) &&
    findProjectFontData(config) !== undefined
}

export function isCanvasKitTextRenderSupported(render: TextRenderConfig): boolean {
  const config = { ...DEFAULT_TEXT_RENDER, ...render }
  const family = config.fontFamily.trim().toLowerCase()
  const projectFontData = findProjectFontData(config)
  if (
    config.fontId
      ? !projectFontData
      : !genericFamilies.has(family) && !projectFontData
  ) {
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

export function isCanvasKitTextRegionSupported(text: string, render: TextRenderConfig): boolean {
  return requiresComplexTextShaping(text)
    ? isCanvasKitParagraphSupported(text, render)
    : isCanvasKitTextRenderSupported(render)
}

export function areCanvasKitTextRegionsSupported(regions: TextRegion[]): boolean {
  return regions.every((region) => {
    const text = region.translatedText?.trim()
    return !text || isCanvasKitTextRegionSupported(text, region.render ?? DEFAULT_TEXT_RENDER)
  })
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
    const layout = layoutText(
      text,
      region.rect.width,
      region.rect.height,
      config,
      (line, fontSize) => {
        activeFont.setSize(fontSize)
        return spacedLineWidth(activeFont, line, config.letterSpacing ?? 0)
      },
    )
    activeFont.setSize(layout.fontSize)
    const linePlans = layout.lines.map((line) => planTextRun(
      line,
      config.letterSpacing ?? 0,
      (unit) => lineWidth(activeFont, unit),
    ))
    if (layout.lines.some((line) => hasUnresolvedGlyphs(activeFont, line))) {
      throw new CanvasKitTextFallbackError('CanvasKit text has unresolved glyphs.')
    }
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
    if (config.overflow !== 'visible') {
      canvas.clipRect(
        canvasKit.LTRBRect(-region.rect.width / 2, -region.rect.height / 2, region.rect.width / 2, region.rect.height / 2),
        canvasKit.ClipOp.Intersect,
        true,
      )
    }
    const outsideStroke = config.stroke?.position === 'outside' ? config.stroke.width : 0
    const baselines = layoutTextBaselines(
      layout.lines.map((line) => canvasKitLineBounds(activeFont, line, layout.fontSize, outsideStroke)),
      layout.lineHeight,
      region.rect.height,
      config.verticalAlign,
    )
    const shadows = config.shadows ?? (config.shadow ? [config.shadow] : [])
    for (const [index, plan] of linePlans.entries()) {
      const width = plan.width
      const x = config.align === 'left' ? -region.rect.width / 2 : config.align === 'right' ? region.rect.width / 2 - width : -width / 2
      const baseline = baselines[index] ?? 0
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
            plan,
            x + shadow.offsetX,
            baseline + shadow.offsetY,
            shadowPaint.paint,
            activeFont,
          )
        } finally {
          filter?.delete()
          disposePaint(shadowPaint)
        }
      }
      if (stroke) drawLine(canvas, plan, x, baseline, stroke.paint, activeFont)
      if (fill) drawLine(canvas, plan, x, baseline, fill.paint, activeFont)
    }
  } finally {
    if (saved) canvas.restore()
    disposePaint(fill)
    disposePaint(stroke)
    font?.delete()
  }
}

function drawParagraphTextRegion(
  canvasKit: CanvasKit,
  canvas: Canvas,
  text: string,
  region: TextRegion,
  render: TextRenderConfig,
): void {
  const config = { ...DEFAULT_TEXT_RENDER, ...render }
  const data = findProjectFontData(config)
  if (!data) throw new CanvasKitTextFallbackError('CanvasKit paragraph font is unavailable.')
  const fill = config.fill ?? { mode: 'solid', color: config.color }
  if (fill.mode !== 'solid' || !isHexColor(fill.color)) {
    throw new CanvasKitTextFallbackError('CanvasKit paragraph paint is unsupported.')
  }
  const maxLines = paragraphMaxLines(region, config)
  if (config.overflow !== 'visible' && maxLines === undefined) {
    throw new CanvasKitTextFallbackError('CanvasKit paragraph cannot fit the text region.')
  }
  let provider: TypefaceFontProvider | undefined
  let builder: ParagraphBuilder | undefined
  let paragraph: Paragraph | undefined
  let saved = false
  try {
    provider = canvasKit.TypefaceFontProvider.Make()
    provider.registerFont(data, config.fontFamily)
    builder = canvasKit.ParagraphBuilder.MakeFromFontProvider({
      textAlign: config.align === 'left'
        ? canvasKit.TextAlign.Left
        : config.align === 'right'
          ? canvasKit.TextAlign.Right
          : canvasKit.TextAlign.Center,
      textDirection: paragraphDirection(text, canvasKit),
      textStyle: {
        color: colorFromHex(canvasKit, fill.color, fill.alpha),
        fontFamilies: [config.fontFamily],
        fontSize: config.fontSize,
        heightMultiplier: config.lineHeight,
        letterSpacing: config.letterSpacing,
      },
      ...(maxLines === undefined ? {} : { maxLines }),
      ...(config.overflow === 'ellipsis' ? { ellipsis: '…' } : {}),
    }, provider)
    builder.addText(text)
    paragraph = builder.build()
    paragraph.layout(region.rect.width)
    if (paragraph.unresolvedCodepoints().length) {
      throw new CanvasKitTextFallbackError('CanvasKit paragraph has unresolved glyphs.')
    }
    const shapedLines = (paragraph as Partial<Paragraph>).getShapedLines?.() ?? []
    const top = shapedLines.length ? Math.min(...shapedLines.map((line) => line.top)) : 0
    const bottom = shapedLines.length
      ? Math.max(...shapedLines.map((line) => line.bottom))
      : paragraph.getHeight()
    const y = alignTextBlockBounds(top, bottom, region.rect.height, config.verticalAlign)
    canvas.save()
    saved = true
    canvas.translate(region.rect.x + region.rect.width / 2, region.rect.y + region.rect.height / 2)
    canvas.rotate(region.rotation, 0, 0)
    if (config.overflow !== 'visible') {
      canvas.clipRect(
        canvasKit.LTRBRect(-region.rect.width / 2, -region.rect.height / 2, region.rect.width / 2, region.rect.height / 2),
        canvasKit.ClipOp.Intersect,
        true,
      )
    }
    canvas.drawParagraph(paragraph, -region.rect.width / 2, y)
  } finally {
    if (saved) canvas.restore()
    paragraph?.delete()
    builder?.delete()
    provider?.delete()
  }
}

export function drawTextRegionWithCanvasKit(
  canvasKit: CanvasKit,
  canvas: Canvas,
  text: string,
  region: TextRegion,
  render: TextRenderConfig,
): void {
  if (!isCanvasKitTextRegionSupported(text, render)) {
    throw new CanvasKitTextFallbackError('CanvasKit text region is unsupported.')
  }
  if (requiresComplexTextShaping(text)) {
    drawParagraphTextRegion(canvasKit, canvas, text, region, render)
    return
  }
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
