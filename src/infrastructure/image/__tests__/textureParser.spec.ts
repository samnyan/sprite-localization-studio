import { describe, expect, it } from 'vitest'

import { parseTextureMetadata } from '@/infrastructure/image/textureParser'

function ddsHeader(options: {
  width: number
  height: number
  fourCC: string
  dxgiFormat?: number
  mipCount?: number
}): ArrayBuffer {
  const data = new ArrayBuffer(options.dxgiFormat === undefined ? 136 : 156)
  const bytes = new Uint8Array(data)
  const view = new DataView(data)
  view.setUint32(0, 0x20534444, true)
  view.setUint32(4, 124, true)
  view.setUint32(12, options.height, true)
  view.setUint32(16, options.width, true)
  view.setUint32(28, options.mipCount ?? 1, true)
  view.setUint32(80, 4, true)
  bytes.set(
    [...options.fourCC].map((character) => character.charCodeAt(0)),
    84,
  )
  if (options.dxgiFormat !== undefined) view.setUint32(128, options.dxgiFormat, true)
  return data
}

describe('textureParser', () => {
  it('reads legacy DDS dimensions and compression metadata', () => {
    const metadata = parseTextureMetadata(
      'textures/ui/atlas.dds',
      ddsHeader({ width: 1360, height: 768, fourCC: 'DXT5', mipCount: 7 }),
    )

    expect(metadata).toEqual({
      size: { width: 1360, height: 768 },
      format: {
        container: 'dds',
        compression: 'bc3',
        header: 'legacy',
        fourCC: 'DXT5',
        srgb: false,
        mipCount: 7,
      },
    })
  })

  it('reads DX10 BC7 sRGB metadata', () => {
    const metadata = parseTextureMetadata(
      'textures/ui/atlas.dds',
      ddsHeader({ width: 256, height: 128, fourCC: 'DX10', dxgiFormat: 99, mipCount: 4 }),
    )

    expect(metadata.format).toEqual({
      container: 'dds',
      compression: 'bc7',
      header: 'dx10',
      fourCC: 'DX10',
      dxgiFormat: 99,
      srgb: true,
      mipCount: 4,
    })
  })

  it('keeps PNG metadata on the same parser path', () => {
    const data = new ArrayBuffer(24)
    const bytes = new Uint8Array(data)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const view = new DataView(data)
    view.setUint32(8, 13)
    view.setUint32(12, 0x49484452)
    view.setUint32(16, 32)
    view.setUint32(20, 48)

    expect(parseTextureMetadata('textures/ui/atlas.png', data)).toEqual({
      size: { width: 32, height: 48 },
      format: { container: 'png' },
    })
  })
})
