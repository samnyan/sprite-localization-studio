import type { TextVerticalAlign } from '@/domain/text-region/types'

export interface TextLineVerticalBounds {
  ascent: number
  descent: number
}

export function alignTextBlockBounds(
  top: number,
  bottom: number,
  regionHeight: number,
  align: TextVerticalAlign | undefined,
): number {
  if (align === 'top') return -regionHeight / 2 - top
  if (align === 'bottom') return regionHeight / 2 - bottom
  return -(top + bottom) / 2
}

export function layoutTextBaselines(
  bounds: TextLineVerticalBounds[],
  lineHeight: number,
  regionHeight: number,
  align: TextVerticalAlign | undefined,
): number[] {
  if (!bounds.length) return []
  const top = Math.min(...bounds.map((line, index) => index * lineHeight - line.ascent))
  const bottom = Math.max(...bounds.map((line, index) => index * lineHeight + line.descent))
  const offset = alignTextBlockBounds(top, bottom, regionHeight, align)
  return bounds.map((_, index) => offset + index * lineHeight)
}
