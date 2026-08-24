import { describe, expect, it } from 'vitest'

import {
  ProjectFormatError,
  ProjectRepository,
  parseProjectManifest,
} from '@/application/project/ProjectRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'

function createStorage(initialText: string): { storage: ProjectStorage; files: Map<string, string> } {
  const files = new Map([['project.json', initialText]])
  const storage: ProjectStorage = {
    async readText(path) {
      const text = files.get(path)
      if (text === undefined) throw new Error(`Missing ${path}`)
      return text
    },
    async writeText(path, text) {
      files.set(path, text)
    },
    async readBinary() {
      throw new Error('Not implemented for this test')
    },
    async writeBinary() {
      throw new Error('Not implemented for this test')
    },
    async exists(path) {
      return files.has(path)
    },
    async list() {
      return []
    },
  }

  return { storage, files }
}

describe('parseProjectManifest', () => {
  it('accepts the minimal v1 project manifest', () => {
    expect(parseProjectManifest('{"schemaVersion":1,"name":"Sample"}')).toEqual({
      schemaVersion: 1,
      name: 'Sample',
    })
  })

  it('rejects unsupported schema versions', () => {
    expect(() => parseProjectManifest('{"schemaVersion":2,"name":"Future"}')).toThrow(
      ProjectFormatError,
    )
  })
})

describe('ProjectRepository', () => {
  it('creates a new project in an empty folder', async () => {
    const { storage, files } = createStorage('')
    files.clear()
    const repository = new ProjectRepository(storage)

    const project = await repository.create('New Project')

    expect(project).toEqual({ schemaVersion: 1, name: 'New Project' })
    expect(JSON.parse(files.get('project.json') ?? '')).toEqual(project)
  })

  it('does not overwrite an existing project', async () => {
    const { storage } = createStorage('{"schemaVersion":1,"name":"Existing"}')
    const repository = new ProjectRepository(storage)

    await expect(repository.create('New Project')).rejects.toMatchObject({
      code: 'alreadyExists',
    })
  })

  it('renames and persists a project without dropping existing fields', async () => {
    const { storage, files } = createStorage(
      '{"schemaVersion":1,"name":"Before","sourceLocale":"ja-JP"}',
    )
    const repository = new ProjectRepository(storage)

    const project = await repository.load()
    const renamed = await repository.rename(project, ' After ')

    expect(renamed.name).toBe('After')
    expect(JSON.parse(files.get('project.json') ?? '')).toEqual({
      schemaVersion: 1,
      name: 'After',
      sourceLocale: 'ja-JP',
    })
  })
})
