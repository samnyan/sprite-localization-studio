import type { Size } from '@/domain/shared/geometry'
import type { Sprite } from '@/domain/sprite/types'

export const SPRITE_TABLE_SCHEMA_VERSION = 2 as const
export type SpriteTableSchemaVersion = 1 | typeof SPRITE_TABLE_SCHEMA_VERSION

export type DdsCompression = 'bc1' | 'bc2' | 'bc3' | 'bc4' | 'bc5' | 'bc6h' | 'bc7'

export interface PngTextureFormat {
  container: 'png'
}

export interface DdsTextureFormat {
  container: 'dds'
  compression: DdsCompression
  header: 'legacy' | 'dx10'
  fourCC?: 'DXT1' | 'DXT3' | 'DXT5' | 'ATI1' | 'ATI2' | 'DX10'
  dxgiFormat?: number
  srgb: boolean
  mipCount: number
}

export type TextureFormat = PngTextureFormat | DdsTextureFormat

export interface Texture {
  id: string
  imagePath: string
  size: Size
  format?: TextureFormat
}

export interface SpriteTable {
  schemaVersion: SpriteTableSchemaVersion
  id: string
  name: string
  textures: Texture[]
  sprites: Sprite[]
}
