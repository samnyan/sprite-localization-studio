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
    async delete() {
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
  it('migrates the minimal v1 project manifest in memory', () => {
    expect(parseProjectManifest('{"schemaVersion":1,"name":"Sample"}')).toEqual({
      schemaVersion: 3,
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

  it('normalizes legacy background references as templates', () => {
    expect(
      parseProjectManifest(
        JSON.stringify({
          schemaVersion: 1,
          name: 'Sample',
          translationBackgrounds: [
            { id: 'button', name: 'Button', path: 'translation-backgrounds/button.png' },
          ],
          translations: [
            {
              spriteTableId: 'ui',
              spriteId: 'button-start',
              backgroundId: 'button',
              textRegions: [],
            },
          ],
        }),
      ).translations?.[0],
    ).toMatchObject({ backgroundId: 'button', backgroundType: 'template' })
  })

  it('rejects duplicate and invalid v2 background references', () => {
    const template = {
      id: 'button',
      name: 'Button',
      path: 'sprite_base/template/id-button.png',
      scope: 'template',
    }
    expect(() =>
      parseProjectManifest(
        JSON.stringify({
          schemaVersion: 2,
          name: 'Sample',
          backgroundTemplates: [template],
          spriteBackgrounds: [
            {
              ...template,
              scope: 'sprite',
              path: 'sprite_base/id-ui/id-button/id-button.png',
              spriteTableId: 'ui',
              spriteId: 'button',
            },
          ],
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalidBackgroundReferences' }))
    expect(() =>
      parseProjectManifest(
        JSON.stringify({
          schemaVersion: 2,
          name: 'Sample',
          translations: [
            {
              spriteTableId: 'ui',
              spriteId: 'button',
              backgroundType: 'template',
              backgroundId: 'missing',
              textRegions: [],
            },
          ],
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalidBackgroundReferences' }))
  })

  it('migrates v2 manifests and preserves project style templates', () => {
    const project = parseProjectManifest(
      JSON.stringify({
        schemaVersion: 2,
        name: 'Sample',
        textStyleTemplates: [
          {
            id: 'project-style',
            name: 'Project Style',
            render: {
              fontFamily: 'sans-serif',
              fontSize: 24,
              fontWeight: 700,
              color: '#ffffff',
              align: 'center',
              fill: {
                mode: 'gradient',
                color: '#ffffff',
                gradientStops: [
                  { color: '#ffffff', position: 0, alpha: 1 },
                  { color: '#000000', position: 1, alpha: 0.5 },
                ],
              },
            },
          },
        ],
      }),
    )

    expect(project).toMatchObject({
      schemaVersion: 3,
      textStyleTemplates: [{ id: 'project-style', name: 'Project Style' }],
    })
  })

  it('rejects invalid gradient stop positions and duplicate project style IDs', () => {
    const render = {
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 700,
      color: '#ffffff',
      align: 'center',
    }
    expect(() =>
      parseProjectManifest(
        JSON.stringify({
          schemaVersion: 3,
          name: 'Sample',
          textStyleTemplates: [
            { id: 'duplicate', name: 'One', render },
            { id: 'duplicate', name: 'Two', render },
          ],
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalidTextStyleTemplates' }))
    expect(() =>
      parseProjectManifest(
        JSON.stringify({
          schemaVersion: 3,
          name: 'Sample',
          textStyleTemplates: [
            {
              id: 'bad-stop',
              name: 'Bad stop',
              render: {
                ...render,
                fill: {
                  mode: 'gradient',
                  color: '#ffffff',
                  gradientStops: [
                    { color: '#ffffff', position: 0 },
                    { color: '#000000', position: 1.1 },
                  ],
                },
              },
            },
          ],
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalidTextStyleTemplates' }))
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

  it('rejects unsupported future schema versions', () => {
    expect(() => parseProjectManifest('{"schemaVersion":4,"name":"Future"}')).toThrow(
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
  it('migrates legacy backgrounds into the template directory before saving the current schema', async () => {
    const files = new Map<string, string>([
      [
        'project.json',
        JSON.stringify({
          schemaVersion: 1,
          name: 'Legacy',
          translationBackgrounds: [
            { id: 'button', name: 'Button', path: 'translation-backgrounds/button.png' },
          ],
        }),
      ],
    ])
    const binaries = new Map<string, Uint8Array>([
      ['translation-backgrounds/button.png', new Uint8Array([1, 2, 3])],
    ])
    const storage: ProjectStorage = {
      async readText(path) {
        const text = files.get(path)
        if (text === undefined) throw new Error(`Missing ${path}`)
        return text
      },
      async writeText(path, text) {
        files.set(path, text)
      },
      async readBinary(path) {
        const data = binaries.get(path)
        if (!data) throw new Error(`Missing ${path}`)
        return new Uint8Array(data).buffer
      },
      async writeBinary(path, data) {
        binaries.set(path, new Uint8Array(data))
      },
      async delete(path) {
        binaries.delete(path)
      },
      async exists(path) {
        return files.has(path)
      },
      async list() {
        return []
      },
    }

    const project = await new ProjectRepository(storage).load()

    expect(project).toMatchObject({
      schemaVersion: 3,
      backgroundTemplates: [
        {
          id: 'button',
          path: 'sprite_base/template/button.png',
          scope: 'template',
        },
      ],
    })
    expect(binaries.get('sprite_base/template/button.png')).toEqual(new Uint8Array([1, 2, 3]))
    expect(JSON.parse(files.get('project.json') ?? '')).toMatchObject({ schemaVersion: 3 })
  })

  it('creates a new project in an empty folder', async () => {
    const { storage, files } = createStorage('')
    files.clear()
    const repository = new ProjectRepository(storage)

    const project = await repository.create('New Project')

    expect(project).toEqual({ schemaVersion: 3, name: 'New Project' })
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
      schemaVersion: 3,
      name: 'After',
      sourceLocale: 'ja-JP',
      translations: [{ spriteTableId: 'ui', spriteId: 'start', textRegions: [] }],
    })
  })
})
