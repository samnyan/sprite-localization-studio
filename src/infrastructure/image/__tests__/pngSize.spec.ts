import { describe, expect, it } from 'vitest'

import { readPngSize } from '@/infrastructure/image/pngSize'

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

describe('readPngSize', () => {
  it('reads the dimensions from the IHDR chunk', () => {
    expect(readPngSize(pngHeader(4096, 2160))).toEqual({ width: 4096, height: 2160 })
  })

  it('rejects data that is not a valid PNG header', () => {
    expect(() => readPngSize(new ArrayBuffer(24))).toThrow('Invalid PNG file.')
    expect(() => readPngSize(pngHeader(0, 1))).toThrow('Invalid PNG dimensions.')
  })
})
