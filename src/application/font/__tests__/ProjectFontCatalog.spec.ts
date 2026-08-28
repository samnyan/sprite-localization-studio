import { describe, expect, it } from 'vitest'

import { scanProjectFonts } from '@/application/font/ProjectFontCatalog'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'

function storage(entries: { name: string; path: string; kind: 'file' | 'directory' }[], data?: ArrayBuffer): ProjectStorage {
  return {
    async readText() {
      throw new Error('Not implemented')
    },
    async writeText() {
      throw new Error('Not implemented')
    },
    async readBinary() {
      if (!data) throw new Error('Missing font')
      return data
    },
    async writeBinary() {
      throw new Error('Not implemented')
    },
    async delete() {
      throw new Error('Not implemented')
    },
    async exists() {
      return false
    },
    async list() {
      return entries
    },
  }
}

describe('project font catalog', () => {
  it('treats a missing fonts directory as an empty catalog', async () => {
    const projectStorage = storage([])
    projectStorage.list = async () => {
      throw new DOMException('Missing directory', 'NotFoundError')
    }

    await expect(scanProjectFonts(projectStorage)).resolves.toEqual({ fonts: [], diagnostics: [] })
  })

  it('reports font directory access failures', async () => {
    const projectStorage = storage([])
    projectStorage.list = async () => {
      throw new Error('Permission denied')
    }

    await expect(scanProjectFonts(projectStorage)).resolves.toEqual({
      fonts: [],
      diagnostics: [{ path: 'fonts', message: 'Permission denied' }],
    })
  })

  it('ignores unsupported entries and reports unreadable font files', async () => {
    const catalog = await scanProjectFonts(
      storage([
        { name: 'preview.png', path: 'fonts/preview.png', kind: 'file' },
        { name: 'nested', path: 'fonts/nested', kind: 'directory' },
        { name: 'Broken.ttf', path: 'fonts/Broken.ttf', kind: 'file' },
      ]),
    )

    expect(catalog.fonts).toEqual([])
    expect(catalog.diagnostics).toEqual([
      expect.objectContaining({ path: 'fonts/Broken.ttf', message: 'Missing font' }),
    ])
  })
})
