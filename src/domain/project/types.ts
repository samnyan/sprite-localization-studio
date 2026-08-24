export const PROJECT_SCHEMA_VERSION = 1 as const

export interface ProjectManifest {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  name: string
  sourceLocale?: string
  targetLocales?: string[]
  atlasManifestPaths?: string[]
}
