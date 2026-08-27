import type { SpriteTranslation, TextStyleTemplate } from '@/domain/text-region/types'
import type { BackgroundTemplate, SpriteBackground } from '@/domain/resource/types'

export const PROJECT_SCHEMA_VERSION = 3 as const

export interface ProjectManifest {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  name: string
  sourceLocale?: string
  targetLocales?: string[]
  spriteTableManifestPaths?: string[]
  translations?: SpriteTranslation[]
  backgroundTemplates?: BackgroundTemplate[]
  spriteBackgrounds?: SpriteBackground[]
  textStyleTemplates?: TextStyleTemplate[]
}
