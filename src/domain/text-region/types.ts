import type { Rect } from '@/domain/shared/geometry'

export interface TextRegion {
  id: string
  rect: Rect
  rotation: number
  translationKey: string
  styleId?: string
}

export interface SpriteTranslation {
  spriteTableId: string
  spriteId: string
  textRegions: TextRegion[]
}
