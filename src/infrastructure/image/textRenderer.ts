import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import type { TextPaint, TextRegion, TextRenderConfig } from '@/domain/text-region/types'
import { layoutText } from '@/domain/text-region/textLayout'

function withAlpha(value: string, alpha?: number): string {
  if (alpha === undefined) return value
  const match = value.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)
  if (!match) return value
  const hex = match[1]!
  const short = hex.length === 3 || hex.length === 4
  const channel = (index: number) => parseInt(short ? hex[index]! + hex[index]! : hex.slice(index * 2, index * 2 + 2), 16)
  const existing = hex.length === 4 ? channel(3) / 255 : hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${Math.max(0, Math.min(1, existing * alpha))})`
}

function paintStyle(
  context: CanvasRenderingContext2D,
  paint: TextPaint | undefined,
  width: number,
  height: number,
): CanvasFillStrokeStyles['fillStyle'] | undefined {
  if (!paint || paint.mode === 'transparent') return undefined
  const start = withAlpha(paint.color, paint.alpha)
  if (paint.mode !== 'gradient') return start
  const angle = ((paint.gradientAngle ?? 0) * Math.PI) / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const extent = Math.abs(dx) * width / 2 + Math.abs(dy) * height / 2
  const gradient = context.createLinearGradient(-dx * extent, -dy * extent, dx * extent, dy * extent)
  const stops = paint.gradientStops?.length
    ? paint.gradientStops
    : paint.gradientEnd
      ? [
          { color: paint.color, position: 0, alpha: paint.alpha },
          { color: paint.gradientEnd, position: 1, alpha: paint.gradientEndAlpha ?? paint.alpha },
        ]
      : []
  if (stops.length < 2) return start
  for (const stop of [...stops].sort((left, right) => left.position - right.position)) {
    gradient.addColorStop(stop.position, withAlpha(stop.color, stop.alpha))
  }
  return gradient
}

function forEachCharacter(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  letterSpacing: number,
  draw: (character: string, x: number) => void,
): void {
  const characters = Array.from(text)
  const totalWidth = characters.reduce((total, character) => total + context.measureText(character).width, 0) +
    Math.max(0, characters.length - 1) * letterSpacing
  const start = context.textAlign === 'left'
    ? x
    : context.textAlign === 'right'
      ? x - totalWidth
      : x - totalWidth / 2
  context.save()
  context.textAlign = 'left'
  let cursor = start
  for (const character of characters) {
    draw(character, cursor)
    cursor += context.measureText(character).width + letterSpacing
  }
  context.restore()
}

function drawLine(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  letterSpacing = 0,
): void {
  if (letterSpacing === 0) {
    context.strokeText(text, x, 0)
    context.fillText(text, x, 0)
    return
  }
  forEachCharacter(context, text, x, letterSpacing, (character, characterX) => {
    context.strokeText(character, characterX, 0)
    context.fillText(character, characterX, 0)
  })
}

function drawInsideLine(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  letterSpacing: number,
): void {
  if (letterSpacing === 0) {
    context.fillText(text, x, 0)
    context.save()
    context.globalCompositeOperation = 'source-atop'
    context.strokeText(text, x, 0)
    context.restore()
    return
  }
  forEachCharacter(context, text, x, letterSpacing, (character, characterX) => {
    context.fillText(character, characterX, 0)
  })
  context.save()
  context.globalCompositeOperation = 'source-atop'
  forEachCharacter(context, text, x, letterSpacing, (character, characterX) => {
    context.strokeText(character, characterX, 0)
  })
  context.restore()
}

export function drawTextRegion(
  context: CanvasRenderingContext2D,
  text: string,
  region: TextRegion,
  render: TextRenderConfig,
): void {
  const config = { ...DEFAULT_TEXT_RENDER, ...render }
  context.save()
  context.translate(region.rect.x + region.rect.width / 2, region.rect.y + region.rect.height / 2)
  context.rotate((region.rotation * Math.PI) / 180)
  if (config.overflow !== 'visible') {
    context.beginPath()
    context.rect(-region.rect.width / 2, -region.rect.height / 2, region.rect.width, region.rect.height)
    context.clip()
  }
  const fill = paintStyle(
    context,
    config.fill ?? { mode: 'solid', color: config.color },
    region.rect.width,
    region.rect.height,
  )
  const stroke =
    config.stroke && config.stroke.width > 0
      ? paintStyle(context, config.stroke.paint, region.rect.width, region.rect.height)
      : undefined
  const setFont = (fontSize: number): void => {
    context.font = `${config.fontStyle ?? 'normal'} ${config.fontWeight} ${fontSize}px ${config.fontFamily}`
  }
  const layout = layoutText(
    text,
    region.rect.width,
    region.rect.height,
    config,
    (line, fontSize) => {
      setFont(fontSize)
      return context.measureText(line).width + Math.max(0, Array.from(line).length - 1) * (config.letterSpacing ?? 0)
    },
  )
  setFont(layout.fontSize)
  context.textAlign = config.align
  context.textBaseline = 'middle'
  const shadows = config.shadows ?? (config.shadow ? [config.shadow] : [])
  const x =
    config.align === 'left'
      ? -region.rect.width / 2
      : config.align === 'right'
        ? region.rect.width / 2
        : 0
  const startY = config.verticalAlign === 'top'
    ? -region.rect.height / 2 + layout.lineHeight / 2
    : config.verticalAlign === 'bottom'
      ? region.rect.height / 2 - layout.height + layout.lineHeight / 2
      : -layout.height / 2 + layout.lineHeight / 2
  for (const [index, line] of layout.lines.entries()) {
    context.save()
    context.translate(0, startY + index * layout.lineHeight)
    context.lineWidth = config.stroke && config.stroke.width > 0 ? config.stroke.width * 2 : 0
    context.strokeStyle = stroke ?? 'transparent'
    context.fillStyle = fill ?? 'transparent'
    for (const shadow of shadows) {
      context.save()
      context.shadowColor = withAlpha(shadow.color, shadow.alpha)
      context.shadowBlur = shadow.blur
      context.shadowOffsetX = shadow.offsetX
      context.shadowOffsetY = shadow.offsetY
      drawLine(context, line, x, config.letterSpacing)
      context.restore()
    }
    context.shadowColor = 'transparent'
    context.shadowBlur = 0
    if (config.stroke?.position === 'inside' && stroke) {
      drawInsideLine(context, line, x, config.letterSpacing ?? 0)
    } else {
      drawLine(context, line, x, config.letterSpacing)
    }
    context.restore()
  }
  context.restore()
}

export function drawTranslationText(
  context: CanvasRenderingContext2D,
  regions: TextRegion[],
): void {
  for (const region of regions) {
    const text = region.translatedText?.trim()
    if (!text) continue
    const config = { ...DEFAULT_TEXT_RENDER, ...region.render }
    drawTextConfigLayers(context, text, region, config)
  }
}

function drawTextConfigLayers(
  context: CanvasRenderingContext2D,
  text: string,
  region: TextRegion,
  config: TextRenderConfig,
): void {
  for (const layer of config.layers ?? []) {
    if (layer.enabled) drawTextConfigLayers(context, text, region, layer.render)
  }
  drawTextRegion(context, text, region, config)
}
