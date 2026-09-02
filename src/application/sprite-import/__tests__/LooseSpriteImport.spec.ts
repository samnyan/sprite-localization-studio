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
    expect(plan.spriteTable.textures).toEqual([
      {
        id: 'BASE',
        imagePath: 'spr_ent_name/BASE.png',
        size: { width: 512, height: 128 },
      },
      {
        id: 'BTN_DELETE_A',
        imagePath: 'spr_ent_name/BTN_DELETE_A.png',
        size: { width: 96, height: 32 },
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

  it('accepts PNG files only and rejects duplicate sprite stems', () => {
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
