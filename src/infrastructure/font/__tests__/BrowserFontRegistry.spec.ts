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
})
