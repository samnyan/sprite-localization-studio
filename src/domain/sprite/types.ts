import type { Point, Rect, Size } from '@/domain/shared/geometry'

export type SpriteRotation = 0 | 90 | 180 | 270

export interface Sprite {
  id: string
  name: string
  frame: Rect
  rotation: SpriteRotation
  trimmed: boolean
  originalSize?: Size
  trimOffset?: Point
}
