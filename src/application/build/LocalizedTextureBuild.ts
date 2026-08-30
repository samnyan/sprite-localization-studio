import type { ProjectManifest } from '@/domain/project/types'
import type { Texture, SpriteTable } from '@/domain/sprite-table/types'
import { collectTextDiagnostics, type TextDiagnostic } from '@/application/qa/TextDiagnostics'
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

export interface LocalizedTextureBuildFailure {
  spriteTableId: string
  textureId: string
  texturePath: string
  spriteId?: string
  message: string
}

export class LocalizedTextureBuildSpriteError extends Error {
  constructor(message: string, readonly spriteId: string) {
    super(message)
    this.name = 'LocalizedTextureBuildSpriteError'
  }
}

export interface LocalizedTextureBuilder {
  buildTexture(task: LocalizedTextureBuildTask): Promise<BuiltTexture>
}

export interface LocalizedTextureBuildReport {
  locale: string
  textures: BuiltTexture[]
  failures: LocalizedTextureBuildFailure[]
  modifiedSpriteCount: number
}

export type LocalizedTextureBuildResult =
  | { status: 'blocked'; diagnostics: TextDiagnostic[] }
  | { status: 'completed' | 'failed'; report: LocalizedTextureBuildReport }

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
  const failures: LocalizedTextureBuildFailure[] = []

  for (const task of plan.tasks) {
    try {
      textures.push(await builder.buildTexture(task))
    } catch (error) {
      const spriteId = error instanceof LocalizedTextureBuildSpriteError ? error.spriteId : undefined
      failures.push({
        spriteTableId: task.spriteTable.id,
        textureId: task.texture.id,
        texturePath: task.texture.imagePath,
        ...(spriteId ? { spriteId } : {}),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    locale: plan.locale,
    textures,
    failures,
    modifiedSpriteCount: textures.reduce(
      (count, texture) => count + texture.modifiedSpriteCount,
      0,
    ),
  }
}

export async function runLocalizedTextureBuild(
  project: ProjectManifest,
  spriteTables: SpriteTable[],
  createBuilder: () => LocalizedTextureBuilder,
): Promise<LocalizedTextureBuildResult> {
  const diagnostics = collectTextDiagnostics(project)
  if (diagnostics.length) return { status: 'blocked', diagnostics }

  const report = await buildLocalizedTextures(
    createLocalizedTextureBuildPlan(project, spriteTables),
    createBuilder(),
  )
  return { status: report.failures.length ? 'failed' : 'completed', report }
}
