import { describe, expect, it } from 'vitest'

import {
  ProjectFormatError,
  ProjectRepository,
  parseProjectManifest,
} from '@/application/project/ProjectRepository'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'

function createStorage(initialText: string): {
  storage: ProjectStorage
  files: Map<string, string>
} {
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

  it('accepts translation metadata without modifying a sprite table manifest', () => {
    expect(
      parseProjectManifest(
        JSON.stringify({
          schemaVersion: 1,
          name: 'Sample',
          translations: [
            {
              spriteTableId: 'ui',
              spriteId: 'button-start',
              textRegions: [
                {
                  id: 'region-1',
                  rect: { x: 12, y: 8, width: 30, height: 14 },
                  rotation: 0,
                  translationKey: 'ui.button-start.1',
                },
              ],
            },
          ],
        }),
      ),
    ).toMatchObject({
      translations: [{ spriteTableId: 'ui', spriteId: 'button-start' }],
    })
  })

  it('rejects duplicate sprite translation metadata and invalid regions', () => {
    expect(() =>
      parseProjectManifest(
        '{"schemaVersion":1,"name":"Sample","translations":[{"spriteTableId":"ui","spriteId":"start","textRegions":[]},{"spriteTableId":"ui","spriteId":"start","textRegions":[]}]}',
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalidTranslations' }))
    expect(() =>
      parseProjectManifest(
        '{"schemaVersion":1,"name":"Sample","translations":[{"spriteTableId":"ui","spriteId":"start","textRegions":[{"id":"one","rect":{"x":0,"y":0,"width":0,"height":1},"rotation":0,"translationKey":"key"}]}]}',
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalidTranslations' }))
  })

  it('rejects unsupported schema versions', () => {
    expect(() => parseProjectManifest('{"schemaVersion":2,"name":"Future"}')).toThrow(
      ProjectFormatError,
    )
  })

  it('rejects sprite table manifest paths outside the project root', () => {
    expect(() =>
      parseProjectManifest(
        '{"schemaVersion":1,"name":"Sample","spriteTableManifestPaths":["../table.json"]}',
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalidSpriteTableManifestPaths' }))
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

    await expect(repository.create('New Project')).rejects.toMatchObject({ code: 'alreadyExists' })
  })

  it('renames and persists a project without dropping existing fields', async () => {
    const { storage, files } = createStorage(
      '{"schemaVersion":1,"name":"Before","sourceLocale":"ja-JP","translations":[{"spriteTableId":"ui","spriteId":"start","textRegions":[]}]}',
    )
    const repository = new ProjectRepository(storage)

    const project = await repository.load()
    const renamed = await repository.rename(project, ' After ')

    expect(renamed.name).toBe('After')
    expect(JSON.parse(files.get('project.json') ?? '')).toEqual({
      schemaVersion: 1,
      name: 'After',
      sourceLocale: 'ja-JP',
      translations: [{ spriteTableId: 'ui', spriteId: 'start', textRegions: [] }],
    })
  })
})
