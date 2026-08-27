import type { Size } from '@/domain/shared/geometry'
import type { Sprite } from '@/domain/sprite/types'

export const SPRITE_TABLE_SCHEMA_VERSION = 1 as const

export interface Texture {
  id: string
  imagePath: string
  size: Size
}

export interface SpriteTable {
  schemaVersion: typeof SPRITE_TABLE_SCHEMA_VERSION
  id: string
  name: string
  textures: Texture[]
  sprites: Sprite[]
}
