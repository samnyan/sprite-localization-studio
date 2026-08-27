import { describe, expect, it } from 'vitest'

import {
  createLocalizedTextureBuildPlan,
  isSpriteTranslationModified,
} from '@/application/build/LocalizedTextureBuild'
import type { ProjectManifest } from '@/domain/project/types'
import type { SpriteTable } from '@/domain/sprite-table/types'
import type { SpriteTranslation } from '@/domain/text-region/types'

const spriteTable: SpriteTable = {
  schemaVersion: 1,
  id: 'ui',
  name: 'UI',
  textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 64, height: 64 } }],
  sprites: [
    {
      id: 'button',
      name: 'Button',
      textureId: 'atlas',
      frame: { x: 0, y: 0, width: 32, height: 32 },
      rotation: 0,
      trimmed: false,
    },
  ],
}

const unchanged: SpriteTranslation = {
  spriteTableId: 'ui',
  spriteId: 'button',
  textRegions: [],
}

function project(translations: SpriteTranslation[]): ProjectManifest {
  return { schemaVersion: 1, name: 'Project', targetLocales: ['zh-CN'], translations }
}

describe('localized texture build plan', () => {
  it('writes every source texture and includes only changed sprites', () => {
    const changed: SpriteTranslation = {
      ...unchanged,
      textRegions: [
        {
          id: 'region',
          rect: { x: 0, y: 0, width: 32, height: 32 },
          rotation: 0,
          translationKey: 'ui.button',
          translatedText: '开始',
        },
      ],
    }

    const plan = createLocalizedTextureBuildPlan(project([unchanged, changed]), [spriteTable])

    expect(plan.locale).toBe('zh-CN')
    expect(plan.tasks).toHaveLength(1)
    expect(plan.tasks[0]).toMatchObject({ outputPath: 'output_textures/zh-CN/ui.png' })
    expect(plan.tasks[0]?.translations).toEqual([changed])
  })

  it('treats blank and template backgrounds as modifications', () => {
    expect(isSpriteTranslationModified({ ...unchanged, backgroundType: 'blank' })).toBe(true)
    expect(isSpriteTranslationModified({ ...unchanged, backgroundType: 'template' })).toBe(true)
    expect(isSpriteTranslationModified(unchanged)).toBe(false)
  })

  it('uses a safe default output directory for an invalid or absent locale', () => {
    expect(
      createLocalizedTextureBuildPlan({ ...project([]), targetLocales: ['../unsafe'] }, [
        spriteTable,
      ]).locale,
    ).toBe('default')
    expect(
      createLocalizedTextureBuildPlan({ ...project([]), targetLocales: [] }, [spriteTable]).locale,
    ).toBe('default')
  })
})
