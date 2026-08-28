import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { isProjectRelativePath } from '@/application/storage/projectPath'
import { PROJECT_SCHEMA_VERSION, type ProjectManifest } from '@/domain/project/types'
import type { BackgroundTemplate, ImageResource, SpriteBackground } from '@/domain/resource/types'
import type { Rect } from '@/domain/shared/geometry'
import {
  resolveBackgroundType,
  type SpriteTranslation,
  type TextRegion,
  type TextStyleTemplate,
} from '@/domain/text-region/types'
import { textStyleTemplates } from '@/domain/text-region/styleTemplates'

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
  | 'invalidBackgroundTemplates'
  | 'invalidSpriteBackgrounds'
  | 'invalidBackgroundReferences'
  | 'invalidTextStyleTemplates'
  | 'invalidStyleReferences'

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

export function isTextRenderConfig(value: unknown): value is TextStyleTemplate['render'] {
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
      (record.alpha === undefined ||
        (Number.isFinite(record.alpha) &&
          (record.alpha as number) >= 0 &&
          (record.alpha as number) <= 1)) &&
      (record.gradientEndAlpha === undefined ||
        (Number.isFinite(record.gradientEndAlpha) &&
          (record.gradientEndAlpha as number) >= 0 &&
          (record.gradientEndAlpha as number) <= 1)) &&
      (record.gradientStops === undefined ||
        (Array.isArray(record.gradientStops) &&
          record.gradientStops.length >= 2 &&
          record.gradientStops.every((stop) => {
            if (!stop || typeof stop !== 'object' || Array.isArray(stop)) return false
            const gradientStop = stop as Record<string, unknown>
            return (
              isNonEmptyString(gradientStop.color) &&
              Number.isFinite(gradientStop.position) &&
              (gradientStop.position as number) >= 0 &&
              (gradientStop.position as number) <= 1 &&
              (gradientStop.alpha === undefined ||
                (Number.isFinite(gradientStop.alpha) &&
                  (gradientStop.alpha as number) >= 0 &&
                  (gradientStop.alpha as number) <= 1))
            )
          })))
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
      (record.alpha === undefined ||
        (Number.isFinite(record.alpha) &&
          (record.alpha as number) >= 0 &&
          (record.alpha as number) <= 1))
    )
  }
  return (
    isNonEmptyString(config.fontFamily) &&
    Number.isFinite(config.fontSize) &&
    (config.fontSize as number) > 0 &&
    Number.isFinite(config.fontWeight) &&
    (config.fontWeight as number) > 0 &&
    (config.fontStyle === undefined ||
      config.fontStyle === 'normal' ||
      config.fontStyle === 'italic' ||
      config.fontStyle === 'oblique') &&
    isNonEmptyString(config.color) &&
    (config.align === 'left' || config.align === 'center' || config.align === 'right') &&
    (config.verticalAlign === undefined ||
      config.verticalAlign === 'top' ||
      config.verticalAlign === 'middle' ||
      config.verticalAlign === 'bottom') &&
    (config.lineHeight === undefined ||
      (Number.isFinite(config.lineHeight) && (config.lineHeight as number) > 0)) &&
    (config.letterSpacing === undefined || Number.isFinite(config.letterSpacing)) &&
    (config.wrap === undefined || typeof config.wrap === 'boolean') &&
    (config.maxLines === undefined ||
      (Number.isInteger(config.maxLines) && (config.maxLines as number) > 0)) &&
    (config.overflow === undefined || config.overflow === 'clip' || config.overflow === 'ellipsis') &&
    (config.autoFit === undefined ||
      (typeof config.autoFit === 'object' &&
        !Array.isArray(config.autoFit) &&
        Number.isFinite((config.autoFit as Record<string, unknown>).minFontSize) &&
        Number.isFinite((config.autoFit as Record<string, unknown>).maxFontSize) &&
        ((config.autoFit as Record<string, unknown>).minFontSize as number) > 0 &&
        ((config.autoFit as Record<string, unknown>).maxFontSize as number) >=
          ((config.autoFit as Record<string, unknown>).minFontSize as number))) &&
    (config.fill === undefined || isPaint(config.fill)) &&
    (config.stroke === undefined || isStroke(config.stroke)) &&
    (config.shadow === undefined || isShadow(config.shadow)) &&
    (config.shadows === undefined ||
      (Array.isArray(config.shadows) && config.shadows.every(isShadow))) &&
    (config.layers === undefined ||
      (Array.isArray(config.layers) &&
        config.layers.every((layer) => {
          if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return false
          const record = layer as Record<string, unknown>
          return (
            isNonEmptyString(record.id) &&
            typeof record.enabled === 'boolean' &&
            isTextRenderConfig(record.render)
          )
        })))
  )
}

function isTextStyleTemplates(value: unknown): value is TextStyleTemplate[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  return value.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const template = item as Record<string, unknown>
    if (
      !isNonEmptyString(template.id) ||
      !isNonEmptyString(template.name) ||
      !isTextRenderConfig(template.render) ||
      ids.has(template.id) ||
      textStyleTemplates.some((builtin) => builtin.id === template.id)
    ) {
      return false
    }
    ids.add(template.id)
    return true
  })
}

function hasValidStyleTemplateReferences(
  translations: SpriteTranslation[],
  projectTemplates: TextStyleTemplate[],
): boolean {
  const templateIds = new Set([
    ...textStyleTemplates.map((template) => template.id),
    ...projectTemplates.map((template) => template.id),
  ])
  return translations.every((translation) =>
    translation.textRegions.every(
      (region) => region.styleId === undefined || templateIds.has(region.styleId),
    ),
  )
}

function isImageResources(value: unknown): value is ImageResource[] {
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

function isLegacyTranslationBackgrounds(value: unknown): value is ImageResource[] {
  return (
    isImageResources(value) &&
    value.every((background) => background.path.startsWith('translation-backgrounds/'))
  )
}

function isBackgroundTemplates(value: unknown): value is BackgroundTemplate[] {
  return (
    isImageResources(value) &&
    value.every(
      (resource) =>
        (resource as BackgroundTemplate).scope === 'template' &&
        resource.path.startsWith('sprite_base/template/'),
    )
  )
}

function isSpriteBackgrounds(value: unknown): value is SpriteBackground[] {
  return (
    isImageResources(value) &&
    value.every((resource) => {
      const background = resource as SpriteBackground
      const segments = background.path.split('/')
      return (
        background.scope === 'sprite' &&
        isNonEmptyString(background.spriteTableId) &&
        isNonEmptyString(background.spriteId) &&
        segments.length >= 4 &&
        segments[0] === 'sprite_base' &&
        segments[1] !== 'template'
      )
    })
  )
}

function hasUniqueBackgroundResources(
  templates: BackgroundTemplate[],
  spriteBackgrounds: SpriteBackground[],
): boolean {
  const ids = new Set<string>()
  const paths = new Set<string>()
  return [...templates, ...spriteBackgrounds].every((resource) => {
    if (ids.has(resource.id) || paths.has(resource.path)) return false
    ids.add(resource.id)
    paths.add(resource.path)
    return true
  })
}

function hasValidBackgroundReferences(
  translations: SpriteTranslation[],
  templates: BackgroundTemplate[],
  spriteBackgrounds: SpriteBackground[],
): boolean {
  return translations.every((translation) => {
    const type = resolveBackgroundType(translation)
    if (type === 'original' || type === 'blank') return translation.backgroundId === undefined
    if (!translation.backgroundId) return false
    if (type === 'template') {
      return templates.some((template) => template.id === translation.backgroundId)
    }
    return spriteBackgrounds.some(
      (background) =>
        background.id === translation.backgroundId &&
        background.spriteTableId === translation.spriteTableId &&
        background.spriteId === translation.spriteId,
    )
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
      (translation.backgroundId !== undefined && !isNonEmptyString(translation.backgroundId)) ||
      (translation.backgroundType !== undefined &&
        translation.backgroundType !== 'original' &&
        translation.backgroundType !== 'blank' &&
        translation.backgroundType !== 'template' &&
        translation.backgroundType !== 'sprite')
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

  if (record.schemaVersion === 1) return migrateLegacyManifest(record)
  if (record.schemaVersion === 2) return migrateV2Manifest(record)

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
    record.backgroundTemplates !== undefined &&
    !isBackgroundTemplates(record.backgroundTemplates)
  ) {
    throw new ProjectFormatError('invalidBackgroundTemplates')
  }

  if (record.spriteBackgrounds !== undefined && !isSpriteBackgrounds(record.spriteBackgrounds)) {
    throw new ProjectFormatError('invalidSpriteBackgrounds')
  }

  if (
    record.textStyleTemplates !== undefined &&
    !isTextStyleTemplates(record.textStyleTemplates)
  ) {
    throw new ProjectFormatError('invalidTextStyleTemplates')
  }

  const translations = (record.translations ?? []) as SpriteTranslation[]
  const templates = (record.backgroundTemplates ?? []) as BackgroundTemplate[]
  const spriteBackgrounds = (record.spriteBackgrounds ?? []) as SpriteBackground[]
  const textStyleTemplates = (record.textStyleTemplates ?? []) as TextStyleTemplate[]
  if (!hasUniqueBackgroundResources(templates, spriteBackgrounds)) {
    throw new ProjectFormatError('invalidBackgroundReferences')
  }
  if (!hasValidBackgroundReferences(translations, templates, spriteBackgrounds)) {
    throw new ProjectFormatError('invalidBackgroundReferences')
  }
  if (!hasValidStyleTemplateReferences(translations, textStyleTemplates)) {
    throw new ProjectFormatError('invalidStyleReferences')
  }

  return { ...record, schemaVersion: PROJECT_SCHEMA_VERSION, name: record.name } as ProjectManifest
}

function migrateV2Manifest(record: Record<string, unknown>): ProjectManifest {
  return parseProjectManifest(
    JSON.stringify({ ...record, schemaVersion: PROJECT_SCHEMA_VERSION }),
  )
}

function migrateLegacyManifest(record: Record<string, unknown>): ProjectManifest {
  if (!isNonEmptyString(record.name)) throw new ProjectFormatError('missingName')

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
    !isLegacyTranslationBackgrounds(record.translationBackgrounds)
  ) {
    throw new ProjectFormatError('invalidTranslationBackgrounds')
  }

  if (
    record.textStyleTemplates !== undefined &&
    !isTextStyleTemplates(record.textStyleTemplates)
  ) {
    throw new ProjectFormatError('invalidTextStyleTemplates')
  }

  const { translationBackgrounds, translations: legacyTranslations, ...project } = record
  const backgroundTemplates = (translationBackgrounds as ImageResource[] | undefined)?.map(
    (background) => ({ ...background, scope: 'template' as const }),
  )
  const migrated = {
    ...project,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name: record.name,
    ...(backgroundTemplates?.length ? { backgroundTemplates } : {}),
    ...(legacyTranslations
      ? {
          translations: (legacyTranslations as SpriteTranslation[]).map((translation) =>
            translation.backgroundId && !translation.backgroundType
              ? { ...translation, backgroundType: 'template' as const }
              : translation,
          ),
        }
      : {}),
  }
  return migrated as ProjectManifest
}

export class ProjectRepository {
  constructor(private readonly storage: ProjectStorage) {}

  async load(): Promise<ProjectManifest> {
    if (!(await this.storage.exists(PROJECT_MANIFEST_PATH))) {
      throw new ProjectFormatError('missingManifest')
    }

    const text = await this.storage.readText(PROJECT_MANIFEST_PATH)
    const project = parseProjectManifest(text)
    if (isLegacyProject(text)) {
      const migrated = await this.copyLegacyBackgrounds(project)
      await this.save(migrated)
      return migrated
    }
    if (isOutdatedProject(text)) await this.save(project)
    return project
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

  private async copyLegacyBackgrounds(project: ProjectManifest): Promise<ProjectManifest> {
    const backgroundTemplates = await Promise.all(
      (project.backgroundTemplates ?? []).map(async (background) => {
        if (!background.path.startsWith('translation-backgrounds/')) return background
        const extension = background.path.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '.png'
        const path = `sprite_base/template/${encodeURIComponent(background.id)}${extension}`
        await this.storage.writeBinary(
          path,
          new Uint8Array(await this.storage.readBinary(background.path)),
        )
        return { ...background, path }
      }),
    )
    return { ...project, ...(backgroundTemplates.length ? { backgroundTemplates } : {}) }
  }
}

function isLegacyProject(text: string): boolean {
  try {
    return (JSON.parse(text) as { schemaVersion?: unknown }).schemaVersion === 1
  } catch {
    return false
  }
}

function isOutdatedProject(text: string): boolean {
  try {
    const schemaVersion = (JSON.parse(text) as { schemaVersion?: unknown }).schemaVersion
    return typeof schemaVersion === 'number' && schemaVersion < PROJECT_SCHEMA_VERSION
  } catch {
    return false
  }
}
