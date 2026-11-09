import UTEX from './vendor/utex.js'
import type { DdsTextureFormat } from '@/domain/sprite-table/types'

export class UnsupportedDdsExportError extends Error {}

export function canEncodeDds(format: DdsTextureFormat): boolean {
  return format.compression === 'bc1' || format.compression === 'bc3'
}

export function assertSingleDdsImage(source: ArrayBuffer, format: DdsTextureFormat): void {
  const input = new DataView(source)
  if (
    (input.getUint32(112, true) & 0x200000) !== 0 ||
    (input.getUint32(112, true) & 0x200) !== 0 ||
    (format.header === 'dx10' &&
      (input.getUint32(132, true) !== 3 ||
        input.getUint32(140, true) !== 1 ||
        (input.getUint32(136, true) & 4) !== 0))
  ) {
    throw new Error(
      'DDS arrays, cubemaps and volume textures cannot be exported as a single image.',
    )
  }
}

function fixBc1Alpha(
  pixels: Uint8Array,
  width: number,
  height: number,
  data: Uint8Array,
  offset: number,
): void {
  for (let by = 0; by < height; by += 4) {
    for (let bx = 0; bx < width; bx += 4) {
      let transparent = false
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          if (pixels[((by + y) * width + bx + x) * 4 + 3]! < 128) transparent = true
        }
      if (transparent) {
        const view = new DataView(data.buffer, data.byteOffset + offset, 8)
        const a = view.getUint16(0, true)
        const b = view.getUint16(2, true)
        const c0 = Math.min(a, b)
        const c1 = Math.max(a, b)
        view.setUint16(0, c0, true)
        view.setUint16(2, c1, true)
        const rgb = (c: number) => [
          (((c >> 11) & 31) * 255) / 31,
          (((c >> 5) & 63) * 255) / 63,
          ((c & 31) * 255) / 31,
        ]
        const p = rgb(c0),
          q = rgb(c1)
        const palette = [p, q, p.map((v, i) => (v + q[i]!) / 2)]
        let indices = 0
        for (let i = 0; i < 16; i++) {
          const pos = ((by + (i >> 2)) * width + bx + (i & 3)) * 4
          let best = 3
          if (pixels[pos + 3]! >= 128) {
            let distance = Infinity
            for (let c = 0; c < 3; c++) {
              const color = palette[c]!
              const d =
                (pixels[pos]! - color[0]!) ** 2 +
                (pixels[pos + 1]! - color[1]!) ** 2 +
                (pixels[pos + 2]! - color[2]!) ** 2
              if (d < distance) {
                distance = d
                best = c
              }
            }
          }
          indices |= best << (i * 2)
        }
        view.setUint32(4, indices >>> 0, true)
      }
      offset += 8
    }
  }
}

/** Re-encodes a 2D DDS while retaining its original header, compression and mip count. */
export function encodeDds(
  canvas: HTMLCanvasElement,
  source: ArrayBuffer,
  format: DdsTextureFormat,
): Uint8Array {
  if (!canEncodeDds(format))
    throw new UnsupportedDdsExportError(
      `Unsupported DDS export format: ${format.compression.toUpperCase()}`,
    )
  const headerSize = format.header === 'dx10' ? 148 : 128
  assertSingleDdsImage(source, format)
  const maxMips = Math.floor(Math.log2(Math.max(canvas.width, canvas.height))) + 1
  if (format.mipCount > maxMips) throw new Error('Invalid DDS mip count.')
  const blockSize = format.compression === 'bc1' ? 8 : 16
  let size = headerSize
  let w = canvas.width,
    h = canvas.height
  for (let i = 0; i < format.mipCount; i++) {
    size += Math.ceil(w / 4) * Math.ceil(h / 4) * blockSize
    w = Math.max(1, w >> 1)
    h = Math.max(1, h >> 1)
  }
  const data = new Uint8Array(size)
  data.set(new Uint8Array(source, 0, headerSize))
  const header = new DataView(data.buffer)
  header.setUint32(20, Math.ceil(canvas.width / 4) * Math.ceil(canvas.height / 4) * blockSize, true)
  let offset = headerSize
  w = canvas.width
  h = canvas.height
  for (let i = 0; i < format.mipCount; i++) {
    const level = document.createElement('canvas')
    level.width = w
    level.height = h
    const ctx = level.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D rendering is unavailable.')
    ctx.drawImage(canvas, 0, 0, w, h)
    const rgba = ctx.getImageData(0, 0, w, h).data
    const pw = Math.ceil(w / 4) * 4,
      ph = Math.ceil(h / 4) * 4
    const pixels = new Uint8Array(pw * ph * 4)
    for (let y = 0; y < ph; y++)
      for (let x = 0; x < pw; x++) {
        const from = (Math.min(y, h - 1) * w + Math.min(x, w - 1)) * 4
        pixels.set(rgba.subarray(from, from + 4), (y * pw + x) * 4)
      }
    const start = offset
    offset =
      format.compression === 'bc1'
        ? UTEX.writeBC1(pixels, pw, ph, data, offset)
        : UTEX.writeBC3(pixels, pw, ph, data, offset)
    if (format.compression === 'bc1') fixBc1Alpha(pixels, pw, ph, data, start)
    w = Math.max(1, w >> 1)
    h = Math.max(1, h >> 1)
  }
  return data
}
