import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { isProjectRelativePath } from '@/application/storage/projectPath'
import { PROJECT_SCHEMA_VERSION, type ProjectManifest } from '@/domain/project/types'
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
    (region.styleId === undefined || isNonEmptyString(region.styleId))
  )
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
      !Array.isArray(translation.textRegions)
    ) {
      return false
    }

    const spriteKey = `${translation.spriteTableId}\u0000${translation.spriteId}`
    if (spriteKeys.has(spriteKey)) return false
    spriteKeys.add(spriteKey)

    const regionIds = new Set<string>()
    return translation.textRegions.every((region) => {
      if (!isTextRegion(region) || regionIds.has(region.id) || translationKeys.has(region.translationKey)) {
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
