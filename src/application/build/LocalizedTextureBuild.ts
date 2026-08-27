import type { ProjectManifest } from '@/domain/project/types'
import type { Texture, SpriteTable } from '@/domain/sprite-table/types'
import { resolveBackgroundType, type SpriteTranslation } from '@/domain/text-region/types'

export interface LocalizedTextureBuildTask {
  spriteTable: SpriteTable
  texture: Texture
  translations: SpriteTranslation[]
  outputPath: string
}

export interface LocalizedTextureBuildPlan {
  locale: string
  tasks: LocalizedTextureBuildTask[]
}

export interface BuiltTexture {
  outputPath: string
  modifiedSpriteCount: number
}

export interface LocalizedTextureBuilder {
  buildTexture(task: LocalizedTextureBuildTask): Promise<BuiltTexture>
}

export interface LocalizedTextureBuildReport {
  locale: string
  textures: BuiltTexture[]
  modifiedSpriteCount: number
}

function outputLocale(project: ProjectManifest): string {
  const locale = project.targetLocales?.[0]?.trim()
  return locale && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(locale) ? locale : 'default'
}

export function isSpriteTranslationModified(translation: SpriteTranslation): boolean {
  if (resolveBackgroundType(translation) !== 'original') {
    return true
  }

  return translation.textRegions.some((region) => Boolean(region.translatedText?.trim()))
}

export function createLocalizedTextureBuildPlan(
  project: ProjectManifest,
  spriteTables: SpriteTable[],
): LocalizedTextureBuildPlan {
  const locale = outputLocale(project)
  const translations = project.translations ?? []

  return {
    locale,
    tasks: spriteTables.flatMap((spriteTable) =>
      spriteTable.textures.map((texture) => ({
        spriteTable,
        texture,
        translations: translations.filter(
          (translation) =>
            translation.spriteTableId === spriteTable.id &&
            spriteTable.sprites.some(
              (sprite) => sprite.id === translation.spriteId && sprite.textureId === texture.id,
            ) &&
            isSpriteTranslationModified(translation),
        ),
        outputPath: `output_textures/${locale}/${texture.imagePath}`,
      })),
    ),
  }
}

export async function buildLocalizedTextures(
  plan: LocalizedTextureBuildPlan,
  builder: LocalizedTextureBuilder,
): Promise<LocalizedTextureBuildReport> {
  const textures: BuiltTexture[] = []

  for (const task of plan.tasks) textures.push(await builder.buildTexture(task))

  return {
    locale: plan.locale,
    textures,
    modifiedSpriteCount: textures.reduce(
      (count, texture) => count + texture.modifiedSpriteCount,
      0,
    ),
  }
}
