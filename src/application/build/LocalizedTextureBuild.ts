import type { ProjectManifest } from '@/domain/project/types'
import type { Texture, SpriteTable } from '@/domain/sprite-table/types'
import { collectTextDiagnostics, type TextDiagnostic } from '@/application/qa/TextDiagnostics'
import { resolveBackgroundType, type SpriteTranslation } from '@/domain/text-region/types'

export interface LocalizedTextureBuildTask {
  cacheKey?: string
  spriteTable: SpriteTable
  texture: Texture
  translations: SpriteTranslation[]
  outputPath: string
}

export interface LocalizedTextureBuildPlan {
  locale: string
  tasks: LocalizedTextureBuildTask[]
}

export interface LocalizedTextureBuildOptions {
  /** Root directory for generated files, relative to project storage. */
  outputRoot?: string
  exportType?: LocalizedTextureExportType
  overwriteType?: LocalizedTextureOverwriteType
  existingOutputKeys?: ReadonlySet<string>
}

export type LocalizedTextureExportType = 'all' | 'translated'
export type LocalizedTextureOverwriteType = 'changed' | 'all'

export interface BuiltTexture {
  outputPath: string
  modifiedSpriteCount: number
  cacheKey?: string
}

export interface LocalizedTextureBuildFailure {
  spriteTableId: string
  textureId: string
  texturePath: string
  spriteId?: string
  message: string
}

export class LocalizedTextureBuildSpriteError extends Error {
  constructor(
    message: string,
    readonly spriteId: string,
  ) {
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
  durationMs: number
}

export interface LocalizedTextureBuildProgress {
  completed: number
  total: number
}

export type LocalizedTextureBuildResult =
  | { status: 'blocked'; diagnostics: TextDiagnostic[] }
  | { status: 'completed' | 'failed'; report: LocalizedTextureBuildReport }

function outputLocale(project: ProjectManifest): string {
  const locale = project.targetLocales?.[0]?.trim()
  return locale && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(locale) ? locale : 'default'
}

export function textureBuildCacheKey(spriteTableId: string, textureId: string): string {
  return JSON.stringify([spriteTableId, textureId])
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
  options: LocalizedTextureBuildOptions = {},
): LocalizedTextureBuildPlan {
  const locale = outputLocale(project)
  const outputRoot = options.outputRoot?.trim() || 'output_textures'
  const translations = project.translations ?? []
  const exportType = options.exportType ?? 'all'
  const overwriteType = options.overwriteType ?? 'all'
  const translationsByTexture = new Map<string, SpriteTranslation[]>()
  const editedTextureKeys = new Set<string>()
  const translatedTextureKeys = new Set<string>()
  const spriteTablesById = new Map(spriteTables.map((spriteTable) => [spriteTable.id, spriteTable]))
  for (const translation of translations) {
    const spriteTable = spriteTablesById.get(translation.spriteTableId)
    const textureId = spriteTable?.sprites.find(
      (sprite) => sprite.id === translation.spriteId,
    )?.textureId
    if (!textureId) continue
    const key = textureBuildCacheKey(translation.spriteTableId, textureId)
    if (translation.edited) editedTextureKeys.add(key)
    if (translation.textRegions.length > 0) translatedTextureKeys.add(key)
    if (!isSpriteTranslationModified(translation)) continue
    const entries = translationsByTexture.get(key) ?? []
    entries.push(translation)
    translationsByTexture.set(key, entries)
  }
  const tasks = spriteTables.flatMap((spriteTable) =>
    spriteTable.textures.flatMap((texture) => {
      const outputPath = `${outputRoot}/${locale}/${texture.imagePath}`
      const cacheKey = textureBuildCacheKey(spriteTable.id, texture.id)
      if (exportType === 'translated' && !translatedTextureKeys.has(cacheKey)) return []
      if (
        overwriteType === 'changed' &&
        (options.existingOutputKeys?.has(cacheKey) ?? true) &&
        !editedTextureKeys.has(cacheKey)
      ) {
        return []
      }

      return [
        {
          cacheKey,
          spriteTable,
          texture,
          translations: translationsByTexture.get(cacheKey) ?? [],
          outputPath,
        },
      ]
    }),
  )

  return {
    locale,
    tasks,
  }
}

export async function buildLocalizedTextures(
  plan: LocalizedTextureBuildPlan,
  builder: LocalizedTextureBuilder,
  onProgress?: (progress: LocalizedTextureBuildProgress) => void,
): Promise<LocalizedTextureBuildReport> {
  const startedAt = performance.now()
  const textures: BuiltTexture[] = []
  const failures: LocalizedTextureBuildFailure[] = []
  onProgress?.({ completed: 0, total: plan.tasks.length })

  for (const task of plan.tasks) {
    try {
      textures.push({
        ...(await builder.buildTexture(task)),
        cacheKey: task.cacheKey,
      })
    } catch (error) {
      const spriteId =
        error instanceof LocalizedTextureBuildSpriteError ? error.spriteId : undefined
      failures.push({
        spriteTableId: task.spriteTable.id,
        textureId: task.texture.id,
        texturePath: task.texture.imagePath,
        ...(spriteId ? { spriteId } : {}),
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      onProgress?.({ completed: textures.length + failures.length, total: plan.tasks.length })
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
    durationMs: Math.round(performance.now() - startedAt),
  }
}

export async function runLocalizedTextureBuild(
  project: ProjectManifest,
  spriteTables: SpriteTable[],
  createBuilder: () => LocalizedTextureBuilder,
  onProgress?: (progress: LocalizedTextureBuildProgress) => void,
  options: LocalizedTextureBuildOptions = {},
): Promise<LocalizedTextureBuildResult> {
  const diagnostics = collectTextDiagnostics(project)
  if (diagnostics.length) return { status: 'blocked', diagnostics }

  const report = await buildLocalizedTextures(
    createLocalizedTextureBuildPlan(project, spriteTables, options),
    createBuilder(),
    onProgress,
  )
  return { status: report.failures.length ? 'failed' : 'completed', report }
}
