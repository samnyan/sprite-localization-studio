import { describe, expect, it } from 'vitest'

import { extractFontFaces } from '@/application/font/fontData'

function makeFace(marker: number): Uint8Array {
  const result = new Uint8Array(32)
  const view = new DataView(result.buffer)
  view.setUint32(0, 0x00010000, false)
  view.setUint16(4, 1, false)
  view.setUint32(12 + 8, 28, false)
  view.setUint32(12 + 12, 4, false)
  result.set([marker, marker + 1, marker + 2, marker + 3], 28)
  return result
}

describe('font collection data', () => {
  it('extracts standalone SFNT buffers from TTC files', () => {
    const first = makeFace(1)
    const second = makeFace(9)
    const collection = new Uint8Array(12 + 8 + first.byteLength + second.byteLength)
    const view = new DataView(collection.buffer)
    view.setUint32(0, 0x74746366, false)
    view.setUint32(8, 2, false)
    view.setUint32(12, 20, false)
    view.setUint32(16, 20 + first.byteLength, false)
    collection.set(first, 20)
    collection.set(second, 20 + first.byteLength)
    view.setUint32(20 + 12 + 8, 20 + 28, false)
    view.setUint32(20 + first.byteLength + 12 + 8, 20 + first.byteLength + 28, false)

    const faces = extractFontFaces(collection.buffer)

    expect(faces).toHaveLength(2)
    expect(Array.from(new Uint8Array(faces[0]!)).slice(-4)).toEqual([1, 2, 3, 4])
    expect(Array.from(new Uint8Array(faces[1]!)).slice(-4)).toEqual([9, 10, 11, 12])
    expect(new DataView(faces[1]!).getUint32(20, false)).toBe(28)
  })
})
