import { describe, expect, it } from 'vitest'

import { parseSpriteTableManifest } from '@/application/sprite-table/SpriteTableRepository'

const textures = [
  {
    id: 'page-00',
    imagePath: 'ui/common/page-00.png',
    size: { width: 512, height: 512 },
  },
  {
    id: 'page-01',
    imagePath: 'ui/dialog/page-01.png',
    size: { width: 256, height: 256 },
  },
]

const trimmedRotatedSprite = {
  id: 'dialog-title',
  name: 'dialog_title',
  textureId: 'page-00',
  frame: { x: 32, y: 64, width: 80, height: 240 },
  rotation: 90,
  trimmed: true,
  originalSize: { width: 280, height: 100 },
  trimOffset: { x: 20, y: 10 },
}

function manifestWith(sprites: unknown[], textureList: unknown[] = textures): string {
  return JSON.stringify({
    schemaVersion: 1,
    id: 'ui-common',
    name: 'UI Common',
    textures: textureList,
    sprites,
  })
}

describe('parseSpriteTableManifest', () => {
  it('parses multiple textures and a referenced sprite', () => {
    const spriteTable = parseSpriteTableManifest(manifestWith([trimmedRotatedSprite]))

    expect(spriteTable.textures).toHaveLength(2)
    expect(spriteTable.sprites[0]).toMatchObject({
      id: 'dialog-title',
      textureId: 'page-00',
      rotation: 90,
      trimmed: true,
      originalSize: { width: 280, height: 100 },
      trimOffset: { x: 20, y: 10 },
    })
  })

  it('accepts texture paths in nested directories', () => {
    expect(parseSpriteTableManifest(manifestWith([])).textures[0]?.imagePath).toBe(
      'ui/common/page-00.png',
    )
  })

  it('rejects an empty texture list', () => {
    expect(() => parseSpriteTableManifest(manifestWith([], []))).toThrowError(
      expect.objectContaining({ code: 'emptyTextures' }),
    )
  })

  it('rejects duplicate texture IDs and paths', () => {
    expect(() =>
      parseSpriteTableManifest(manifestWith([], [textures[0], { ...textures[1], id: 'page-00' }])),
    ).toThrowError(expect.objectContaining({ code: 'duplicateTextureId' }))

    expect(() =>
      parseSpriteTableManifest(
        manifestWith([], [textures[0], { ...textures[1], imagePath: textures[0]?.imagePath }]),
      ),
    ).toThrowError(expect.objectContaining({ code: 'duplicateTexturePath' }))
  })

  it('rejects unknown texture references', () => {
    expect(() =>
      parseSpriteTableManifest(manifestWith([{ ...trimmedRotatedSprite, textureId: 'missing' }])),
    ).toThrowError(expect.objectContaining({ code: 'unknownTextureId' }))
  })

  it('checks frames against the referenced texture', () => {
    const sprite = {
      ...trimmedRotatedSprite,
      textureId: 'page-01',
      frame: { x: 200, y: 0, width: 80, height: 240 },
    }

    expect(() => parseSpriteTableManifest(manifestWith([sprite]))).toThrowError(
      expect.objectContaining({ code: 'frameOutOfBounds' }),
    )
  })

  it('rejects duplicate sprite IDs', () => {
    expect(() =>
      parseSpriteTableManifest(manifestWith([trimmedRotatedSprite, trimmedRotatedSprite])),
    ).toThrowError(expect.objectContaining({ code: 'duplicateSpriteId' }))
  })

  it('rejects texture paths outside the project root', () => {
    expect(() =>
      parseSpriteTableManifest(manifestWith([], [{ ...textures[0], imagePath: '../page-00.png' }])),
    ).toThrowError(expect.objectContaining({ code: 'invalidPath' }))
  })

  it('rejects the implicit textures directory prefix', () => {
    expect(() =>
      parseSpriteTableManifest(
        manifestWith([], [{ ...textures[0], imagePath: 'textures/page-00.png' }]),
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalidPath' }))
  })
})
