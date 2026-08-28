import type { TextRenderConfig } from '@/domain/text-region/types'

export interface TextLayoutResult {
  fontSize: number
  lineHeight: number
  lines: string[]
  height: number
  overflowed: boolean
}

export type TextMeasure = (text: string, fontSize: number) => number

function wrapLine(line: string, width: number, fontSize: number, measure: TextMeasure): string[] {
  if (!line || measure(line, fontSize) <= width) return [line]
  const lines: string[] = []
  let current = ''
  for (const character of Array.from(line)) {
    const next = current + character
    if (current && measure(next, fontSize) > width) {
      lines.push(current)
      current = character
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function ellipsize(line: string, width: number, fontSize: number, measure: TextMeasure): string {
  const suffix = '…'
  let result = line
  while (result && measure(`${result}${suffix}`, fontSize) > width) result = result.slice(0, -1)
  return `${result}${suffix}`
}

function layoutAtSize(
  text: string,
  width: number,
  height: number,
  config: TextRenderConfig,
  fontSize: number,
  measure: TextMeasure,
): TextLayoutResult {
  const lineHeight = fontSize * (config.lineHeight ?? 1.2)
  const sourceLines = text.split(/\r?\n/)
  const lines = config.wrap
    ? sourceLines.flatMap((line) => wrapLine(line, width, fontSize, measure))
    : sourceLines
  let overflowed = lines.some((line) => measure(line, fontSize) > width)
  const maxLines = config.maxLines
  if (maxLines && lines.length > maxLines) {
    overflowed = true
    lines.length = maxLines
    if (config.overflow === 'ellipsis') lines[maxLines - 1] = ellipsize(lines[maxLines - 1] ?? '', width, fontSize, measure)
  }
  const result = { fontSize, lineHeight, lines, height: lines.length * lineHeight, overflowed }
  return { ...result, overflowed: result.overflowed || result.height > height }
}

export function layoutText(
  text: string,
  width: number,
  height: number,
  config: TextRenderConfig,
  measure: TextMeasure,
): TextLayoutResult {
  const fit = config.autoFit
  if (!fit) return layoutAtSize(text, width, height, config, config.fontSize, measure)
  let lower = fit.minFontSize
  let upper = fit.maxFontSize
  let best = layoutAtSize(text, width, height, config, lower, measure)
  while (lower <= upper) {
    const size = Math.floor((lower + upper) / 2)
    const candidate = layoutAtSize(text, width, height, config, size, measure)
    if (candidate.overflowed) {
      upper = size - 1
    } else {
      best = candidate
      lower = size + 1
    }
  }
  return best
}
