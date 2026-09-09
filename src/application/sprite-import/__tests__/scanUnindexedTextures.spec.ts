import { describe, expect, it } from 'vitest'

import type { ProjectEntry, ProjectStorage } from '@/application/storage/ProjectStorage'
import { scanUnindexedTextures } from '@/application/sprite-import/scanUnindexedTextures'

function pngHeader(width: number, height: number): ArrayBuffer {
  const data = new ArrayBuffer(24)
  const bytes = new Uint8Array(data)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(data)
  view.setUint32(8, 13)
  view.setUint32(12, 0x49484452)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return data
}

function ddsHeader(width: number, height: number): ArrayBuffer {
  const data = new ArrayBuffer(136)
  const bytes = new Uint8Array(data)
  const view = new DataView(data)
  view.setUint32(0, 0x20534444, true)
  view.setUint32(4, 124, true)
  view.setUint32(12, height, true)
  view.setUint32(16, width, true)
  view.setUint32(28, 1, true)
  view.setUint32(80, 4, true)
  bytes.set(
    Array.from('DXT1').map((character) => character.charCodeAt(0)),
    84,
  )
  return data
}

function createStorage(initial: Record<string, string | ArrayBuffer>): ProjectStorage {
  const files = new Map(Object.entries(initial))
  return {
    async readText(path) {
      const value = files.get(path)
      if (typeof value !== 'string') throw new Error(`Missing text: ${path}`)
      return value
    },
    async writeText(path, text) {
      files.set(path, text)
    },
    async readBinary(path) {
      const value = files.get(path)
      if (!(value instanceof ArrayBuffer)) throw new Error(`Missing binary: ${path}`)
      return value
    },
    async writeBinary(path, data) {
      const copy = new Uint8Array(data)
      files.set(path, copy.buffer)
    },
    async delete(path) {
      files.delete(path)
    },
    async exists(path) {
      return files.has(path)
    },
    async list(path): Promise<ProjectEntry[]> {
      const prefix = path ? `${path}/` : ''
      const children = new Map<string, ProjectEntry>()
      for (const filePath of files.keys()) {
        if (!filePath.startsWith(prefix)) continue
        const rest = filePath.slice(prefix.length)
        if (!rest) continue
        const [name, ...tail] = rest.split('/')
        children.set(name!, {
          name: name!,
          path: `${prefix}${name}`,
          kind: tail.length ? 'directory' : 'file',
        })
      }
      return [...children.values()]
    },
  }
}

describe('scanUnindexedTextures', () => {
  it('skips indexed files and writes manifests with parsed texture metadata', async () => {
    const storage = createStorage({
      'manifests/existing.sprite-table.json': JSON.stringify({
        textures: [{ imagePath: 'data_jp/common/Texture/TestMode/already.png' }],
      }),
      'textures/data_jp/common/Texture/TestMode/0.png': pngHeader(4000, 2000),
      'textures/data_jp/common/Texture/TestMode/1.png': pngHeader(32, 48),
      'textures/data_jp/common/Texture/TestMode/2.dds': ddsHeader(64, 32),
      'textures/data_jp/common/Texture/TestMode/already.png': pngHeader(1, 1),
    })
    const progress: Array<[number, number]> = []

    const results = await scanUnindexedTextures(
      storage,
      ['manifests/existing.sprite-table.json'],
      (completed, total) => progress.push([completed, total]),
    )

    expect(results).toEqual([
      {
        manifestPath: 'manifests/data_jp.sprite-table.json',
        imagePaths: [
          'data_jp/common/Texture/TestMode/0.png',
          'data_jp/common/Texture/TestMode/1.png',
          'data_jp/common/Texture/TestMode/2.dds',
        ],
      },
    ])
    expect(progress[0]).toEqual([0, 3])
    expect(progress[progress.length - 1]).toEqual([3, 3])
    const manifest = JSON.parse(await storage.readText('manifests/data_jp.sprite-table.json')) as {
      schemaVersion: number
      textures: { id: string; size: { width: number; height: number } }[]
    }
    expect(manifest.schemaVersion).toBe(2)
    expect(manifest.textures).toEqual([
      {
        id: 'common/Texture/TestMode/0',
        imagePath: 'data_jp/common/Texture/TestMode/0.png',
        size: { width: 4000, height: 2000 },
        format: { container: 'png' },
      },
      {
        id: 'common/Texture/TestMode/1',
        imagePath: 'data_jp/common/Texture/TestMode/1.png',
        size: { width: 32, height: 48 },
        format: { container: 'png' },
      },
      {
        id: 'common/Texture/TestMode/2',
        imagePath: 'data_jp/common/Texture/TestMode/2.dds',
        size: { width: 64, height: 32 },
        format: {
          container: 'dds',
          compression: 'bc1',
          header: 'legacy',
          fourCC: 'DXT1',
          srgb: false,
          mipCount: 1,
        },
      },
    ])
  })
})
