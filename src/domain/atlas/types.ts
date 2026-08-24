import type { Size } from '@/domain/shared/geometry'
import type { Sprite } from '@/domain/sprite/types'

export interface Atlas {
  id: string
  name: string
  imagePath: string
  size: Size
  sprites: Sprite[]
}
