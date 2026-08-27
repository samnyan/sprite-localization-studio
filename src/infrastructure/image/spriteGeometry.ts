import type { Size } from '@/domain/shared/geometry'
import type { Sprite } from '@/domain/sprite/types'

export interface CanvasTransform {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export function getLogicalTrimmedSize(sprite: Sprite): Size {
  if (sprite.rotation === 90 || sprite.rotation === 270) {
    return { width: sprite.frame.height, height: sprite.frame.width }
  }

  return { width: sprite.frame.width, height: sprite.frame.height }
}

export function getLogicalSpriteSize(sprite: Sprite): Size {
  return sprite.trimmed && sprite.originalSize ? sprite.originalSize : getLogicalTrimmedSize(sprite)
}

export function getStoredToLogicalTransform(sprite: Sprite): CanvasTransform {
  const { width, height } = sprite.frame

  switch (sprite.rotation) {
    case 90:
      return { a: 0, b: -1, c: 1, d: 0, e: 0, f: width }
    case 180:
      return { a: -1, b: 0, c: 0, d: -1, e: width, f: height }
    case 270:
      return { a: 0, b: 1, c: -1, d: 0, e: height, f: 0 }
    default:
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  }
}

export function getLogicalToStoredTransform(sprite: Sprite): CanvasTransform {
  const { width, height } = sprite.frame

  switch (sprite.rotation) {
    case 90:
      return { a: 0, b: 1, c: -1, d: 0, e: width, f: 0 }
    case 180:
      return { a: -1, b: 0, c: 0, d: -1, e: width, f: height }
    case 270:
      return { a: 0, b: -1, c: 1, d: 0, e: 0, f: height }
    default:
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  }
}
