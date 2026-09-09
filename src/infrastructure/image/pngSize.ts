import type { Size } from '@/domain/shared/geometry'

export function readPngSize(data: ArrayBuffer): Size {
  const bytes = new Uint8Array(data)
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    throw new Error('Invalid PNG file.')
  }
  const view = new DataView(data)
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) {
    throw new Error('Invalid PNG header.')
  }
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (!width || !height) throw new Error('Invalid PNG dimensions.')
  return { width, height }
}
