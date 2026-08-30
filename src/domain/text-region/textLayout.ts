import type { TextRenderConfig } from '@/domain/text-region/types'

export interface TextLayoutResult {
  fontSize: number
  lineHeight: number
  lines: string[]
  height: number
  overflowed: boolean
}

export type TextMeasure = (text: string, fontSize: number) => number

export interface TextRunPlan {
  advances: number[]
  units: string[]
  width: number
}

interface GraphemeSegmenter {
  segment(text: string): Iterable<{ segment: string }>
}

const Segmenter = (Intl as typeof Intl & {
  Segmenter?: new (locales?: string | string[], options?: { granularity: 'grapheme' }) => GraphemeSegmenter
}).Segmenter
const graphemeSegmenter = Segmenter
  ? new Segmenter(undefined, { granularity: 'grapheme' })
  : undefined

export function splitTextGraphemes(text: string): string[] {
  return graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment)
    : [text]
}

export function planTextRun(
  text: string,
  letterSpacing: number,
  measureUnit: (unit: string) => number,
  preserveWholeRun = false,
): TextRunPlan {
  const units = letterSpacing === 0 || preserveWholeRun ? [text] : splitTextGraphemes(text)
  const effectiveSpacing = preserveWholeRun ? 0 : letterSpacing
  const advances = units.map((unit, index) =>
    measureUnit(unit) + (index < units.length - 1 ? effectiveSpacing : 0),
  )
  return { units, advances, width: advances.reduce((total, advance) => total + advance, 0) }
}

function wrapLine(line: string, width: number, fontSize: number, measure: TextMeasure): string[] {
  if (!line || measure(line, fontSize) <= width) return [line]
  const lines: string[] = []
  let current = ''
  for (const grapheme of splitTextGraphemes(line)) {
    const next = current + grapheme
    if (current && measure(next, fontSize) > width) {
      lines.push(current)
      current = grapheme
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function ellipsize(line: string, width: number, fontSize: number, measure: TextMeasure): string {
  const suffix = '…'
  const graphemes = splitTextGraphemes(line)
  while (graphemes.length && measure(`${graphemes.join('')}${suffix}`, fontSize) > width) {
    graphemes.pop()
  }
  return `${graphemes.join('')}${suffix}`
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
  const widthOverflow = lines.some((line) => measure(line, fontSize) > width)
  const heightLimit = config.overflow === 'visible'
    ? lines.length
    : Math.max(0, Math.floor(height / lineHeight))
  const visibleLines = Math.min(config.maxLines ?? lines.length, heightLimit)
  const hiddenLines = lines.length > visibleLines
  if (hiddenLines) lines.length = visibleLines
  if (config.overflow === 'ellipsis' && lines.length) {
    const last = lines.length - 1
    if (hiddenLines || measure(lines[last] ?? '', fontSize) > width) {
      lines[last] = ellipsize(lines[last] ?? '', width, fontSize, measure)
    }
  }
  const result = { fontSize, lineHeight, lines, height: lines.length * lineHeight, overflowed: widthOverflow || hiddenLines }
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
