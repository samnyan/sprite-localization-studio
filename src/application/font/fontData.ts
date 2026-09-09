const TTC_SIGNATURE = 0x74746366

function align4(value: number): number {
  return (value + 3) & ~3
}

function readSignature(view: DataView): number {
  return view.getUint32(0, false)
}

/** Returns standalone SFNT buffers so font collections can be loaded as individual faces. */
export function extractFontFaces(data: ArrayBuffer): ArrayBuffer[] {
  const bytes = new Uint8Array(data)
  const view = new DataView(data)
  if (bytes.byteLength < 12 || readSignature(view) !== TTC_SIGNATURE) return [data]

  const count = view.getUint32(8, false)
  if (count < 1 || 12 + count * 4 > bytes.byteLength) {
    throw new Error('Invalid TrueType font collection.')
  }

  return Array.from({ length: count }, (_, index) => {
    const base = view.getUint32(12 + index * 4, false)
    return extractSfnt(data, base, true)
  })
}

function extractSfnt(data: ArrayBuffer, base: number, collection: boolean): ArrayBuffer {
  const bytes = new Uint8Array(data)
  const view = new DataView(data)
  if (base < 0 || base + 12 > bytes.byteLength) throw new Error('Invalid SFNT face offset.')

  const tableCount = view.getUint16(base + 4, false)
  const directorySize = 12 + tableCount * 16
  if (base + directorySize > bytes.byteLength) throw new Error('Invalid SFNT table directory.')

  const tables: { record: number; source: number; length: number; target: number }[] = []
  let cursor = directorySize
  for (let index = 0; index < tableCount; index += 1) {
    const record = base + 12 + index * 16
    const tableOffset = view.getUint32(record + 8, false)
    const length = view.getUint32(record + 12, false)
    const source = collection ? tableOffset : base + tableOffset
    if (source + length > bytes.byteLength) throw new Error('Invalid SFNT table range.')
    cursor = align4(cursor)
    tables.push({ record, source, length, target: cursor })
    cursor += length
  }

  const result = new Uint8Array(cursor)
  result.set(bytes.subarray(base, base + directorySize), 0)
  const resultView = new DataView(result.buffer)
  for (const table of tables) {
    const targetRecord = table.record - base
    resultView.setUint32(targetRecord + 8, table.target, false)
    result.set(bytes.subarray(table.source, table.source + table.length), table.target)
  }
  return result.buffer
}
