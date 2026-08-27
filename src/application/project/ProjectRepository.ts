import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { isProjectRelativePath } from '@/application/storage/projectPath'
import { PROJECT_SCHEMA_VERSION, type ProjectManifest } from '@/domain/project/types'
import type { ImageResource } from '@/domain/resource/types'
import type { Rect } from '@/domain/shared/geometry'
import type { SpriteTranslation, TextRegion } from '@/domain/text-region/types'

export const PROJECT_MANIFEST_PATH = 'project.json'

export type ProjectFormatErrorCode =
  | 'invalidJson'
  | 'invalidRoot'
  | 'unsupportedSchema'
  | 'missingName'
  | 'missingManifest'
  | 'emptyName'
  | 'alreadyExists'
  | 'invalidSpriteTableManifestPaths'
  | 'invalidTranslations'
  | 'invalidTranslationBackgrounds'

export class ProjectFormatError extends Error {
  override readonly name = 'ProjectFormatError'

  constructor(
    readonly code: ProjectFormatErrorCode,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code)
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim())
}

function isRect(value: unknown): value is Rect {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const rect = value as Record<string, unknown>
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    (rect.width as number) > 0 &&
    (rect.height as number) > 0
  )
}

function isTextRegion(value: unknown): value is TextRegion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const region = value as Record<string, unknown>
  return (
    isNonEmptyString(region.id) &&
    isRect(region.rect) &&
    Number.isFinite(region.rotation) &&
    isNonEmptyString(region.translationKey) &&
    (region.styleId === undefined || isNonEmptyString(region.styleId)) &&
    (region.sourceText === undefined || typeof region.sourceText === 'string') &&
    (region.translatedText === undefined || typeof region.translatedText === 'string') &&
    (region.render === undefined || isTextRenderConfig(region.render))
  )
}

function isTextRenderConfig(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const config = value as Record<string, unknown>
  const isPaint = (paint: unknown): boolean => {
    if (!paint || typeof paint !== 'object' || Array.isArray(paint)) return false
    const record = paint as Record<string, unknown>
    return (
      (record.mode === 'transparent' || record.mode === 'solid' || record.mode === 'gradient') &&
      isNonEmptyString(record.color) &&
      (record.gradientEnd === undefined || isNonEmptyString(record.gradientEnd)) &&
      (record.gradientAngle === undefined || Number.isFinite(record.gradientAngle)) &&
      (record.alpha === undefined || (Number.isFinite(record.alpha) && (record.alpha as number) >= 0 && (record.alpha as number) <= 1)) &&
      (record.gradientEndAlpha === undefined || (Number.isFinite(record.gradientEndAlpha) && (record.gradientEndAlpha as number) >= 0 && (record.gradientEndAlpha as number) <= 1))
    )
  }
  const isStroke = (stroke: unknown): boolean => {
    if (!stroke || typeof stroke !== 'object' || Array.isArray(stroke)) return false
    const record = stroke as Record<string, unknown>
    return (
      Number.isFinite(record.width) &&
      (record.width as number) >= 0 &&
      (record.position === 'inside' || record.position === 'outside') &&
      isPaint(record.paint)
    )
  }
  const isShadow = (shadow: unknown): boolean => {
    if (!shadow || typeof shadow !== 'object' || Array.isArray(shadow)) return false
    const record = shadow as Record<string, unknown>
    return (
      isNonEmptyString(record.color) &&
      Number.isFinite(record.blur) &&
      Number.isFinite(record.offsetX) &&
      Number.isFinite(record.offsetY) &&
      (record.alpha === undefined || (Number.isFinite(record.alpha) && (record.alpha as number) >= 0 && (record.alpha as number) <= 1))
    )
  }
  return (
    isNonEmptyString(config.fontFamily) &&
    Number.isFinite(config.fontSize) &&
    (config.fontSize as number) > 0 &&
    Number.isFinite(config.fontWeight) &&
    (config.fontWeight as number) > 0 &&
    isNonEmptyString(config.color) &&
    (config.align === 'left' || config.align === 'center' || config.align === 'right') &&
    (config.lineHeight === undefined ||
      (Number.isFinite(config.lineHeight) && (config.lineHeight as number) > 0)) &&
    (config.fill === undefined || isPaint(config.fill)) &&
    (config.stroke === undefined || isStroke(config.stroke)) &&
    (config.shadow === undefined || isShadow(config.shadow)) &&
    (config.shadows === undefined || (Array.isArray(config.shadows) && config.shadows.every(isShadow))) &&
    (config.layers === undefined || (Array.isArray(config.layers) && config.layers.every((layer) => {
      if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return false
      const record = layer as Record<string, unknown>
      return isNonEmptyString(record.id) && typeof record.enabled === 'boolean' && isTextRenderConfig(record.render)
    })))
  )
}

function isTranslationBackgrounds(value: unknown): value is ImageResource[] {
  if (!Array.isArray(value)) return false

  const ids = new Set<string>()
  const paths = new Set<string>()
  return value.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const resource = item as Record<string, unknown>
    if (
      !isNonEmptyString(resource.id) ||
      !isNonEmptyString(resource.name) ||
      !isNonEmptyString(resource.path) ||
      !isProjectRelativePath(resource.path) ||
      !resource.path.startsWith('translation-backgrounds/') ||
      ids.has(resource.id) ||
      paths.has(resource.path)
    ) {
      return false
    }

    ids.add(resource.id)
    paths.add(resource.path)
    return true
  })
}

function isTranslations(value: unknown): value is SpriteTranslation[] {
  if (!Array.isArray(value)) return false

  const spriteKeys = new Set<string>()
  const translationKeys = new Set<string>()

  return value.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false

    const translation = item as Record<string, unknown>
    if (
      !isNonEmptyString(translation.spriteTableId) ||
      !isNonEmptyString(translation.spriteId) ||
      !Array.isArray(translation.textRegions) ||
      (translation.backgroundId !== undefined && !isNonEmptyString(translation.backgroundId))
    ) {
      return false
    }

    const spriteKey = `${translation.spriteTableId}\u0000${translation.spriteId}`
    if (spriteKeys.has(spriteKey)) return false
    spriteKeys.add(spriteKey)

    const regionIds = new Set<string>()
    return translation.textRegions.every((region) => {
      if (
        !isTextRegion(region) ||
        regionIds.has(region.id) ||
        translationKeys.has(region.translationKey)
      ) {
        return false
      }

      regionIds.add(region.id)
      translationKeys.add(region.translationKey)
      return true
    })
  })
}

export function parseProjectManifest(text: string): ProjectManifest {
  let value: unknown

  try {
    value = JSON.parse(text)
  } catch {
    throw new ProjectFormatError('invalidJson')
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProjectFormatError('invalidRoot')
  }

  const record = value as Record<string, unknown>

  if (record.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectFormatError('unsupportedSchema', { version: String(record.schemaVersion) })
  }

  if (!isNonEmptyString(record.name)) {
    throw new ProjectFormatError('missingName')
  }

  if (
    record.spriteTableManifestPaths !== undefined &&
    (!Array.isArray(record.spriteTableManifestPaths) ||
      record.spriteTableManifestPaths.some(
        (path) => typeof path !== 'string' || !isProjectRelativePath(path),
      ))
  ) {
    throw new ProjectFormatError('invalidSpriteTableManifestPaths')
  }

  if (record.translations !== undefined && !isTranslations(record.translations)) {
    throw new ProjectFormatError('invalidTranslations')
  }

  if (
    record.translationBackgrounds !== undefined &&
    !isTranslationBackgrounds(record.translationBackgrounds)
  ) {
    throw new ProjectFormatError('invalidTranslationBackgrounds')
  }

  return { ...record, schemaVersion: PROJECT_SCHEMA_VERSION, name: record.name } as ProjectManifest
}

export class ProjectRepository {
  constructor(private readonly storage: ProjectStorage) {}

  async load(): Promise<ProjectManifest> {
    if (!(await this.storage.exists(PROJECT_MANIFEST_PATH))) {
      throw new ProjectFormatError('missingManifest')
    }

    return parseProjectManifest(await this.storage.readText(PROJECT_MANIFEST_PATH))
  }

  async save(project: ProjectManifest): Promise<void> {
    await this.storage.writeText(PROJECT_MANIFEST_PATH, `${JSON.stringify(project, null, 2)}\n`)
  }

  async create(name: string): Promise<ProjectManifest> {
    if (await this.storage.exists(PROJECT_MANIFEST_PATH)) {
      throw new ProjectFormatError('alreadyExists')
    }

    const trimmedName = name.trim()
    if (!trimmedName) throw new ProjectFormatError('emptyName')

    const project: ProjectManifest = { schemaVersion: PROJECT_SCHEMA_VERSION, name: trimmedName }
    await this.save(project)
    return project
  }

  async rename(project: ProjectManifest, name: string): Promise<ProjectManifest> {
    const trimmedName = name.trim()
    if (!trimmedName) throw new ProjectFormatError('emptyName')

    const updated = { ...project, name: trimmedName }
    await this.save(updated)
    return updated
  }
}
