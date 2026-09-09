import { decodeImage, parseDDSHeader, type ImageFormat } from 'dds-ktx-parser'

import type { Size } from '@/domain/shared/geometry'
import type { DdsCompression, TextureFormat } from '@/domain/sprite-table/types'

import { readPngSize } from './pngSize'

export interface ParsedTextureMetadata {
  size: Size
  format: TextureFormat
}

const DDS_MAGIC = 0x20534444
const DDS_HEADER_SIZE = 124
const DDS_PIXEL_FORMAT_OFFSET = 80
const DDS_FOUR_CC_OFFSET = DDS_PIXEL_FORMAT_OFFSET + 4
const DDS_MIP_COUNT_OFFSET = 28
const DDS_DX10_HEADER_OFFSET = 128

const DXGI_FORMATS: Record<number, { compression: DdsCompression; srgb: boolean }> = {
  70: { compression: 'bc1', srgb: false },
  71: { compression: 'bc1', srgb: false },
  72: { compression: 'bc1', srgb: true },
  73: { compression: 'bc2', srgb: false },
  74: { compression: 'bc2', srgb: false },
  75: { compression: 'bc2', srgb: true },
  76: { compression: 'bc3', srgb: false },
  77: { compression: 'bc3', srgb: false },
  78: { compression: 'bc3', srgb: true },
  79: { compression: 'bc4', srgb: false },
  80: { compression: 'bc4', srgb: false },
  81: { compression: 'bc4', srgb: false },
  82: { compression: 'bc5', srgb: false },
  83: { compression: 'bc5', srgb: false },
  84: { compression: 'bc5', srgb: false },
  94: { compression: 'bc6h', srgb: false },
  95: { compression: 'bc6h', srgb: false },
  96: { compression: 'bc6h', srgb: false },
  97: { compression: 'bc7', srgb: false },
  98: { compression: 'bc7', srgb: false },
  99: { compression: 'bc7', srgb: true },
}

const LEGACY_FORMATS: Record<string, DdsCompression> = {
  DXT1: 'bc1',
  DXT3: 'bc2',
  DXT5: 'bc3',
  ATI1: 'bc4',
  ATI2: 'bc5',
}

function extension(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1).toLocaleLowerCase()
}

function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  )
}

function parserBuffer(data: ArrayBuffer): Parameters<typeof parseDDSHeader>[0] {
  return new Uint8Array(data) as unknown as Parameters<typeof parseDDSHeader>[0]
}

function parseDdsMetadata(data: ArrayBuffer): ParsedTextureMetadata {
  const bytes = new Uint8Array(data)
  if (bytes.byteLength < DDS_DX10_HEADER_OFFSET) throw new Error('Invalid DDS file.')

  const view = new DataView(data)
  if (view.getUint32(0, true) !== DDS_MAGIC || view.getUint32(4, true) !== DDS_HEADER_SIZE) {
    throw new Error('Invalid DDS header.')
  }

  let info: ReturnType<typeof parseDDSHeader>
  try {
    info = parseDDSHeader(parserBuffer(data))
  } catch {
    info = undefined
  }
  if (!info || !info.shape.width || !info.shape.height) {
    throw new Error('Unsupported DDS format.')
  }

  const fourCC = readFourCC(bytes, DDS_FOUR_CC_OFFSET)
  const mipCount = Math.max(1, view.getUint32(DDS_MIP_COUNT_OFFSET, true))
  if (fourCC === 'DX10') {
    if (bytes.byteLength < DDS_DX10_HEADER_OFFSET + 20) throw new Error('Invalid DDS DX10 header.')
    const dxgiFormat = view.getUint32(DDS_DX10_HEADER_OFFSET, true)
    const dxgi = DXGI_FORMATS[dxgiFormat]
    if (!dxgi || imageFormat(dxgi.compression) !== info.format) {
      throw new Error('Unsupported DDS DXGI format.')
    }

    return {
      size: info.shape,
      format: {
        container: 'dds',
        compression: dxgi.compression,
        header: 'dx10',
        fourCC: 'DX10',
        dxgiFormat,
        srgb: dxgi.srgb,
        mipCount,
      },
    }
  }

  const compression = LEGACY_FORMATS[fourCC]
  if (!compression || imageFormat(compression) !== info.format) {
    throw new Error('Unsupported DDS FourCC format.')
  }

  return {
    size: info.shape,
    format: {
      container: 'dds',
      compression,
      header: 'legacy',
      fourCC: fourCC as 'DXT1' | 'DXT3' | 'DXT5' | 'ATI1' | 'ATI2',
      srgb: false,
      mipCount,
    },
  }
}

function imageFormat(compression: DdsCompression): ImageFormat {
  return compression.toUpperCase() as ImageFormat
}

export function parseTextureMetadata(path: string, data: ArrayBuffer): ParsedTextureMetadata {
  switch (extension(path)) {
    case 'png':
      return { size: readPngSize(data), format: { container: 'png' } }
    case 'dds':
      return parseDdsMetadata(data)
    default:
      throw new Error(`Unsupported texture format: ${path}`)
  }
}

export async function createTextureImageBitmap(
  path: string,
  data: ArrayBuffer,
): Promise<ImageBitmap> {
  const metadata = parseTextureMetadata(path, data)
  if (metadata.format.container === 'png') {
    return createImageBitmap(new Blob([data], { type: 'image/png' }))
  }

  const info = parseDDSHeader(parserBuffer(data))
  const layer = info?.layers[0]
  if (!info || !layer) throw new Error('DDS mip level 0 is unavailable.')
  const rgba = decodeImage(parserBuffer(data), info.format, layer)
  const pixels = new Uint8ClampedArray(rgba.byteLength)
  pixels.set(rgba)
  return createImageBitmap(
    new ImageData(
      pixels as Uint8ClampedArray<ArrayBuffer>,
      metadata.size.width,
      metadata.size.height,
    ),
  )
}

export async function createTexturePreviewBlob(path: string, data: ArrayBuffer): Promise<Blob> {
  if (extension(path) !== 'dds') {
    return new Blob([data], { type: 'image/png' })
  }

  const bitmap = await createTextureImageBitmap(path, data)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Texture preview is unavailable.')
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Texture preview encoding failed.'))
    }, 'image/png')
  })
}
