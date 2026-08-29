import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { BrowserFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'

class FakeFontFace {
  readonly weight: string
  readonly style: string

  constructor(
    readonly family: string,
    _data: ArrayBuffer,
    descriptors: FontFaceDescriptors = {},
  ) {
    this.weight = descriptors.weight ?? 'normal'
    this.style = descriptors.style ?? 'normal'
  }

  async load(): Promise<this> {
    return this
  }
}

function createStorage(): ProjectStorage {
  return {
    readText: async () => '',
    writeText: async () => undefined,
    readBinary: async () => new Uint8Array([1]).buffer,
    writeBinary: async () => undefined,
    delete: async () => undefined,
    exists: async () => true,
    list: async () => [],
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('BrowserFontRegistry', () => {
  it('publishes loaded fonts together and advances the version once', async () => {
    const add = vi.fn<(font: FontFace) => void>()
    vi.stubGlobal('FontFace', FakeFontFace)
    vi.stubGlobal('document', { fonts: { add, delete: vi.fn<(font: FontFace) => void>() } })
    const registry = new BrowserFontRegistry()

    const result = await registry.register(createStorage(), [
      { id: 'regular', path: 'fonts/regular.ttf', family: 'Demo', weight: 400, style: 'normal' },
      { id: 'bold', path: 'fonts/bold.ttf', family: 'Demo', weight: 700, style: 'normal' },
    ])

    expect(result.registeredIds).toEqual(['regular', 'bold'])
    expect(registry.version).toBe(1)
    expect(add).toHaveBeenCalledTimes(2)
    expect(registry.findData('Demo', 700, 'normal')).toBeInstanceOf(ArrayBuffer)
  })

  it('does not publish a stale concurrent registration', async () => {
    const add = vi.fn<(font: FontFace) => void>()
    let releaseFirst: (() => void) | undefined
    let signalFirstRead: (() => void) | undefined
    const firstRead = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const firstReadStarted = new Promise<void>((resolve) => {
      signalFirstRead = resolve
    })
    const storage: ProjectStorage = {
      ...createStorage(),
      async readBinary(path) {
        if (path === 'fonts/first.ttf') {
          signalFirstRead?.()
          await firstRead
        }
        return new Uint8Array([1]).buffer
      },
    }
    vi.stubGlobal('FontFace', FakeFontFace)
    vi.stubGlobal('document', { fonts: { add, delete: vi.fn<(font: FontFace) => void>() } })
    const registry = new BrowserFontRegistry()

    const first = registry.register(storage, [
      { id: 'first', path: 'fonts/first.ttf', family: 'First', weight: 400, style: 'normal' },
    ])
    await firstReadStarted
    const second = registry.register(storage, [
      { id: 'second', path: 'fonts/second.ttf', family: 'Second', weight: 400, style: 'normal' },
    ])
    releaseFirst?.()

    await expect(first).resolves.toEqual({ registeredIds: [], diagnostics: [] })
    await expect(second).resolves.toMatchObject({ registeredIds: ['second'] })
    expect(add).toHaveBeenCalledTimes(1)
    expect(registry.findData('First', 400, 'normal')).toBeUndefined()
    expect(registry.findData('Second', 400, 'normal')).toBeInstanceOf(ArrayBuffer)
  })
})
