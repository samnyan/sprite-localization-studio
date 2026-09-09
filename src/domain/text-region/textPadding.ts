import type { TextPadding } from '@/domain/text-region/types'

export interface TextContentArea {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

export function resolveTextContentArea(
  width: number,
  height: number,
  padding?: Partial<TextPadding>,
): TextContentArea {
  const top = padding?.top ?? 0
  const right = padding?.right ?? 0
  const bottom = padding?.bottom ?? 0
  const left = padding?.left ?? 0
  return {
    width: Math.max(0, width - left - right),
    height: Math.max(0, height - top - bottom),
    offsetX: (left - right) / 2,
    offsetY: (top - bottom) / 2,
  }
}
