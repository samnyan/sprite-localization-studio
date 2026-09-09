import { describe, expect, it } from 'vitest'

import {
  createLooseSpriteImportPlan,
  isLooseSpriteImage,
} from '@/application/sprite-import/LooseSpriteImport'

describe('LooseSpriteImport', () => {
  it('creates one full-frame sprite per PNG and preserves the source directory layout', () => {
    const plan = createLooseSpriteImportPlan('spr_ent_name', [
      { name: 'BASE.png', size: { width: 512, height: 128 } },
      { name: 'BTN_DELETE_A.png', size: { width: 96, height: 32 } },
    ])

    expect(plan.manifestPath).toBe('manifests/spr_ent_name.sprite-table.json')
    expect(plan.spriteTable).toMatchObject({ id: 'spr_ent_name', name: 'spr_ent_name' })
    expect(plan.spriteTable.schemaVersion).toBe(2)
    expect(plan.spriteTable.textures).toEqual([
      {
        id: 'BASE',
        imagePath: 'spr_ent_name/BASE.png',
        size: { width: 512, height: 128 },
        format: { container: 'png' },
      },
      {
        id: 'BTN_DELETE_A',
        imagePath: 'spr_ent_name/BTN_DELETE_A.png',
        size: { width: 96, height: 32 },
        format: { container: 'png' },
      },
    ])
    expect(plan.spriteTable.sprites).toEqual([
      expect.objectContaining({
        id: 'BASE',
        textureId: 'BASE',
        frame: { x: 0, y: 0, width: 512, height: 128 },
        rotation: 0,
        trimmed: false,
      }),
      expect.objectContaining({
        id: 'BTN_DELETE_A',
        textureId: 'BTN_DELETE_A',
        frame: { x: 0, y: 0, width: 96, height: 32 },
      }),
    ])
  })

  it('preserves arbitrarily nested relative paths and generates unique ids', () => {
    const plan = createLooseSpriteImportPlan('sprites', [
      { name: 'a/b/c/icon.png', size: { width: 2, height: 3 } },
      { name: 'x/icon.png', size: { width: 4, height: 5 } },
    ])
    expect(plan.spriteTable.textures.map((texture) => texture.imagePath)).toEqual([
      'sprites/a/b/c/icon.png',
      'sprites/x/icon.png',
    ])
    expect(plan.spriteTable.sprites.map((sprite) => sprite.id)).toEqual(['a/b/c/icon', 'x/icon'])
    expect(plan.spriteTable.textures.map((texture) => texture.id)).toEqual(
      plan.spriteTable.sprites.map((sprite) => sprite.textureId),
    )
    expect(plan.spriteTable.textures[0]?.id).not.toContain('__')
  })

  it('keeps underscores in the source path without using them as separators', () => {
    const plan = createLooseSpriteImportPlan('sprites', [
      { name: 'menu_main/button__large.png', size: { width: 8, height: 4 } },
    ])

    expect(plan.spriteTable.textures[0]).toMatchObject({
      id: 'menu_main/button__large',
      imagePath: 'sprites/menu_main/button__large.png',
    })
  })
  it('detects supported image extensions and rejects duplicate names', () => {
    expect(isLooseSpriteImage('BTN.PNG')).toBe(true)
    expect(isLooseSpriteImage('BTN.webp')).toBe(false)
    expect(() =>
      createLooseSpriteImportPlan('sprites', [
        { name: 'BTN.png', size: { width: 1, height: 1 } },
        { name: 'BTN.PNG', size: { width: 1, height: 1 } },
      ]),
    ).toThrow('Duplicate loose sprite image')
  })
})
