export interface ImageResource {
  id: string
  name: string
  path: string
}

export interface BackgroundTemplate extends ImageResource {
  scope: 'template'
}

export interface SpriteBackground extends ImageResource {
  scope: 'sprite'
  spriteTableId: string
  spriteId: string
}
