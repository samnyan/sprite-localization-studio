import { describe, expect, it } from 'vitest'

import {
  createLocalizedTextureBuildPlan,
  isSpriteTranslationModified,
  runLocalizedTextureBuild,
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
  return { schemaVersion: 3, name: 'Project', targetLocales: ['zh-CN'], translations }
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
    expect(isSpriteTranslationModified({ ...unchanged, backgroundType: 'sprite' })).toBe(true)
    expect(isSpriteTranslationModified({ ...unchanged, backgroundId: 'legacy-template' })).toBe(
      true,
    )
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

  it('does not create a builder when translation diagnostics block the build', async () => {
    let builderCreated = false
    const result = await runLocalizedTextureBuild(
      project([{
        ...unchanged,
        textRegions: [{
          id: 'region',
          rect: { x: 0, y: 0, width: 32, height: 32 },
          rotation: 0,
          translationKey: 'ui.button',
        }],
      }]),
      [spriteTable],
      () => {
        builderCreated = true
        return { buildTexture: async () => ({ outputPath: 'unexpected', modifiedSpriteCount: 0 }) }
      },
    )

    expect(result).toMatchObject({ status: 'blocked', diagnostics: [{ code: 'missingTranslation' }] })
    expect(builderCreated).toBe(false)
  })

  it('creates a builder and reports a completed build after QA passes', async () => {
    const changed: SpriteTranslation = {
      ...unchanged,
      textRegions: [{
        id: 'region',
        rect: { x: 0, y: 0, width: 32, height: 32 },
        rotation: 0,
        translationKey: 'ui.button',
        translatedText: 'Start',
      }],
    }
    const builtPaths: string[] = []

    const result = await runLocalizedTextureBuild(project([changed]), [spriteTable], () => ({
      buildTexture: async (task) => {
        builtPaths.push(task.outputPath)
        return { outputPath: task.outputPath, modifiedSpriteCount: 1 }
      },
    }))

    expect(result).toMatchObject({
      status: 'completed',
      report: { locale: 'zh-CN', modifiedSpriteCount: 1 },
    })
    expect(builtPaths).toEqual(['output_textures/zh-CN/ui.png'])
  })

  it('continues after a texture failure and reports its source identifiers', async () => {
    const spriteTableWithTwoTextures: SpriteTable = {
      ...spriteTable,
      textures: [
        ...spriteTable.textures,
        { id: 'atlas-2', imagePath: 'ui-2.png', size: { width: 64, height: 64 } },
      ],
    }
    const builtPaths: string[] = []

    const result = await runLocalizedTextureBuild(project([]), [spriteTableWithTwoTextures], () => ({
      buildTexture: async (task) => {
        if (task.texture.id === 'atlas') throw new Error('Source image could not be loaded.')
        builtPaths.push(task.outputPath)
        return { outputPath: task.outputPath, modifiedSpriteCount: 0 }
      },
    }))

    expect(result).toMatchObject({
      status: 'failed',
      report: {
        textures: [{ outputPath: 'output_textures/zh-CN/ui-2.png' }],
        failures: [
          {
            spriteTableId: 'ui',
            textureId: 'atlas',
            texturePath: 'ui.png',
            message: 'Source image could not be loaded.',
          },
        ],
      },
    })
    expect(builtPaths).toEqual(['output_textures/zh-CN/ui-2.png'])
  })
})
