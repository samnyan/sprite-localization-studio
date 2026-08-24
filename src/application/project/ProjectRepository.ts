import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import {
  PROJECT_SCHEMA_VERSION,
  type ProjectManifest,
} from '@/domain/project/types'

export const PROJECT_MANIFEST_PATH = 'project.json'

export type ProjectFormatErrorCode =
  | 'invalidJson'
  | 'invalidRoot'
  | 'unsupportedSchema'
  | 'missingName'
  | 'missingManifest'
  | 'emptyName'
  | 'alreadyExists'

export class ProjectFormatError extends Error {
  override readonly name = 'ProjectFormatError'

  constructor(
    readonly code: ProjectFormatErrorCode,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code)
  }
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
    throw new ProjectFormatError('unsupportedSchema', {
      version: String(record.schemaVersion),
    })
  }

  if (typeof record.name !== 'string' || !record.name.trim()) {
    throw new ProjectFormatError('missingName')
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

    if (!trimmedName) {
      throw new ProjectFormatError('emptyName')
    }

    const project: ProjectManifest = {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      name: trimmedName,
    }

    await this.save(project)
    return project
  }

  async rename(project: ProjectManifest, name: string): Promise<ProjectManifest> {
    const trimmedName = name.trim()

    if (!trimmedName) {
      throw new ProjectFormatError('emptyName')
    }

    const updated = { ...project, name: trimmedName }
    await this.save(updated)
    return updated
  }
}
