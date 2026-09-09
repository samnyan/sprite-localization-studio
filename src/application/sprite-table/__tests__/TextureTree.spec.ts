import { describe, expect, it } from 'vitest'

import { createTextureTree } from '@/application/sprite-table/TextureTree'

describe('createTextureTree', () => {
  it('builds nested directories and maps files to their sprites', () => {
    const tree = createTextureTree({
      schemaVersion: 1,
      id: 'data_jp',
      name: 'data_jp',
      textures: [
        {
          id: 'common/Texture/TestMode/0',
          imagePath: 'data_jp/common/Texture/TestMode/0.png',
          size: { width: 2, height: 3 },
        },
        {
          id: 'common/Texture/TestMode/1',
          imagePath: 'data_jp/common/Texture/TestMode/1.png',
          size: { width: 4, height: 5 },
        },
      ],
      sprites: [
        {
          id: 'common/Texture/TestMode/0',
          name: '0',
          textureId: 'common/Texture/TestMode/0',
          frame: { x: 0, y: 0, width: 2, height: 3 },
          rotation: 0,
          trimmed: false,
        },
        {
          id: 'common/Texture/TestMode/1',
          name: '1',
          textureId: 'common/Texture/TestMode/1',
          frame: { x: 0, y: 0, width: 4, height: 5 },
          rotation: 0,
          trimmed: false,
        },
      ],
    })

    expect(tree[0]).toMatchObject({ name: 'data_jp', type: 'directory', path: 'data_jp' })
    expect(tree[0]?.children[0]).toMatchObject({ name: 'common', path: 'data_jp/common' })
    expect(tree[0]?.children[0]?.children[0]?.children[0]?.children[0]).toMatchObject({
      name: '0.png',
      type: 'file',
      path: 'data_jp/common/Texture/TestMode/0.png',
      spriteId: 'common/Texture/TestMode/0',
      textureId: 'common/Texture/TestMode/0',
    })
  })

  it('keeps files under their actual parent directory', () => {
    const tree = createTextureTree({
      schemaVersion: 1,
      id: 'ui',
      name: 'ui',
      textures: [
        { id: 'a', imagePath: 'ui/one/a.png', size: { width: 1, height: 1 } },
        { id: 'b', imagePath: 'ui/two/b.png', size: { width: 1, height: 1 } },
      ],
      sprites: [],
    })

    expect(tree).toHaveLength(1)
    expect(tree[0]?.children.map((node) => node.name)).toEqual(['one', 'two'])
    expect(tree[0]?.children[0]?.children[0]?.name).toBe('a.png')
    expect(tree[0]?.children[1]?.children[0]?.name).toBe('b.png')
  })
})
