import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { isProjectRelativePath } from '@/application/storage/projectPath'
import type { Point, Rect, Size } from '@/domain/shared/geometry'
import {
  SPRITE_TABLE_SCHEMA_VERSION,
  type DdsCompression,
  type TextureFormat,
  type SpriteTable,
  type Texture,
} from '@/domain/sprite-table/types'
import type { Sprite, SpriteRotation } from '@/domain/sprite/types'

export type SpriteTableFormatErrorCode =
  | 'invalidJson'
  | 'invalidRoot'
  | 'unsupportedSchema'
  | 'invalidField'
  | 'invalidPath'
  | 'emptyTextures'
  | 'duplicateSpriteTableId'
  | 'duplicateTextureId'
  | 'duplicateTexturePath'
  | 'unknownTextureId'
  | 'duplicateSpriteId'
  | 'frameOutOfBounds'
  | 'trimOutOfBounds'

export class SpriteTableFormatError extends Error {
  override readonly name = 'SpriteTableFormatError'

  constructor(
    readonly code: SpriteTableFormatErrorCode,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code)
  }
}

type JsonObject = Record<string, unknown>

function expectObject(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SpriteTableFormatError(field === 'root' ? 'invalidRoot' : 'invalidField', {
      field,
    })
  }

  return value as JsonObject
}

function expectString(object: JsonObject, key: string, parent = ''): string {
  const value = object[key]
  const field = parent ? `${parent}.${key}` : key

  if (typeof value !== 'string' || !value.trim()) {
    throw new SpriteTableFormatError('invalidField', { field })
  }

  return value
}

function expectInteger(object: JsonObject, key: string, parent: string, minimum: number): number {
  const value = object[key]

  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new SpriteTableFormatError('invalidField', { field: `${parent}.${key}` })
  }

  return value as number
}

function parseSize(value: unknown, field: string): Size {
  const object = expectObject(value, field)
  return {
    width: expectInteger(object, 'width', field, 1),
    height: expectInteger(object, 'height', field, 1),
  }
}

function parsePoint(value: unknown, field: string): Point {
  const object = expectObject(value, field)
  return {
    x: expectInteger(object, 'x', field, 0),
    y: expectInteger(object, 'y', field, 0),
  }
}

function parseRect(value: unknown, field: string): Rect {
  const object = expectObject(value, field)
  return {
    x: expectInteger(object, 'x', field, 0),
    y: expectInteger(object, 'y', field, 0),
    width: expectInteger(object, 'width', field, 1),
    height: expectInteger(object, 'height', field, 1),
  }
}

function parseRotation(value: unknown, field: string): SpriteRotation {
  if (value !== 0 && value !== 90 && value !== 180 && value !== 270) {
    throw new SpriteTableFormatError('invalidField', { field })
  }

  return value
}

function parseTextureFormat(value: unknown, field: string): TextureFormat {
  const object = expectObject(value, field)
  if (object.container === 'png') return { container: 'png' }

  if (object.container !== 'dds') {
    throw new SpriteTableFormatError('invalidField', { field: `${field}.container` })
  }

  const compression = object.compression
  if (
    compression !== 'bc1' &&
    compression !== 'bc2' &&
    compression !== 'bc3' &&
    compression !== 'bc4' &&
    compression !== 'bc5' &&
    compression !== 'bc6h' &&
    compression !== 'bc7'
  ) {
    throw new SpriteTableFormatError('invalidField', { field: `${field}.compression` })
  }

  const header = object.header
  if (header !== 'legacy' && header !== 'dx10') {
    throw new SpriteTableFormatError('invalidField', { field: `${field}.header` })
  }

  const fourCC = object.fourCC
  if (
    fourCC !== undefined &&
    fourCC !== 'DXT1' &&
    fourCC !== 'DXT3' &&
    fourCC !== 'DXT5' &&
    fourCC !== 'ATI1' &&
    fourCC !== 'ATI2' &&
    fourCC !== 'DX10'
  ) {
    throw new SpriteTableFormatError('invalidField', { field: `${field}.fourCC` })
  }

  const rawDxgiFormat = object.dxgiFormat
  const dxgiFormat = typeof rawDxgiFormat === 'number' ? rawDxgiFormat : undefined
  if (
    (header === 'dx10' && (!Number.isInteger(dxgiFormat) || (dxgiFormat as number) < 0)) ||
    (header === 'legacy' && rawDxgiFormat !== undefined)
  ) {
    throw new SpriteTableFormatError('invalidField', { field: `${field}.dxgiFormat` })
  }

  if (typeof object.srgb !== 'boolean') {
    throw new SpriteTableFormatError('invalidField', { field: `${field}.srgb` })
  }

  if (!Number.isInteger(object.mipCount) || (object.mipCount as number) < 1) {
    throw new SpriteTableFormatError('invalidField', { field: `${field}.mipCount` })
  }

  return {
    container: 'dds',
    compression: compression as DdsCompression,
    header,
    ...(fourCC === undefined ? {} : { fourCC }),
    ...(dxgiFormat === undefined ? {} : { dxgiFormat }),
    srgb: object.srgb as boolean,
    mipCount: object.mipCount as number,
  }
}

function parseTexture(value: unknown, index: number, schemaVersion: number): Texture {
  const field = `textures[${index}]`
  const object = expectObject(value, field)
  const imagePath = expectString(object, 'imagePath', field)
  const format =
    schemaVersion === 1
      ? ({ container: 'png' } as const)
      : parseTextureFormat(object.format, `${field}.format`)

  if (
    !isProjectRelativePath(imagePath) ||
    (format.container === 'png' && !imagePath.toLowerCase().endsWith('.png')) ||
    (format.container === 'dds' && !imagePath.toLowerCase().endsWith('.dds')) ||
    imagePath.toLowerCase().startsWith('textures/')
  ) {
    throw new SpriteTableFormatError('invalidPath', { path: imagePath })
  }

  return {
    id: expectString(object, 'id', field),
    imagePath,
    size: parseSize(object.size, `${field}.size`),
    format,
  }
}

function parseSprite(value: unknown, index: number, texturesById: Map<string, Texture>): Sprite {
  const field = `sprites[${index}]`
  const object = expectObject(value, field)
  const id = expectString(object, 'id', field)
  const textureId = expectString(object, 'textureId', field)
  const texture = texturesById.get(textureId)

  if (!texture) {
    throw new SpriteTableFormatError('unknownTextureId', { sprite: id, texture: textureId })
  }

  const frame = parseRect(object.frame, `${field}.frame`)
  const rotation = parseRotation(object.rotation, `${field}.rotation`)

  if (frame.x + frame.width > texture.size.width || frame.y + frame.height > texture.size.height) {
    throw new SpriteTableFormatError('frameOutOfBounds', { sprite: id, texture: textureId })
  }

  if (typeof object.trimmed !== 'boolean') {
    throw new SpriteTableFormatError('invalidField', { field: `${field}.trimmed` })
  }

  const sprite: Sprite = {
    id,
    name: expectString(object, 'name', field),
    textureId,
    frame,
    rotation,
    trimmed: object.trimmed,
  }

  if (!sprite.trimmed) {
    return sprite
  }

  const originalSize = parseSize(object.originalSize, `${field}.originalSize`)
  const trimOffset = parsePoint(object.trimOffset, `${field}.trimOffset`)
  const trimmedWidth = rotation === 90 || rotation === 270 ? frame.height : frame.width
  const trimmedHeight = rotation === 90 || rotation === 270 ? frame.width : frame.height

  if (
    trimOffset.x + trimmedWidth > originalSize.width ||
    trimOffset.y + trimmedHeight > originalSize.height
  ) {
    throw new SpriteTableFormatError('trimOutOfBounds', { sprite: sprite.id })
  }

  return { ...sprite, originalSize, trimOffset }
}

export function parseSpriteTableManifest(text: string): SpriteTable {
  let value: unknown

  try {
    value = JSON.parse(text)
  } catch {
    throw new SpriteTableFormatError('invalidJson')
  }

  const object = expectObject(value, 'root')

  if (object.schemaVersion !== 1 && object.schemaVersion !== SPRITE_TABLE_SCHEMA_VERSION) {
    throw new SpriteTableFormatError('unsupportedSchema', {
      version: String(object.schemaVersion),
    })
  }

  if (!Array.isArray(object.textures)) {
    throw new SpriteTableFormatError('invalidField', { field: 'textures' })
  }

  if (object.textures.length === 0) {
    throw new SpriteTableFormatError('emptyTextures')
  }

  const textures = object.textures.map((texture, index) =>
    parseTexture(texture, index, object.schemaVersion as number),
  )
  const texturesById = new Map<string, Texture>()
  const texturePaths = new Set<string>()

  for (const texture of textures) {
    if (texturesById.has(texture.id)) {
      throw new SpriteTableFormatError('duplicateTextureId', { id: texture.id })
    }

    if (texturePaths.has(texture.imagePath)) {
      throw new SpriteTableFormatError('duplicateTexturePath', { path: texture.imagePath })
    }

    texturesById.set(texture.id, texture)
    texturePaths.add(texture.imagePath)
  }

  if (!Array.isArray(object.sprites)) {
    throw new SpriteTableFormatError('invalidField', { field: 'sprites' })
  }

  const sprites = object.sprites.map((sprite, index) => parseSprite(sprite, index, texturesById))
  const spriteIds = new Set<string>()

  for (const sprite of sprites) {
    if (spriteIds.has(sprite.id)) {
      throw new SpriteTableFormatError('duplicateSpriteId', { id: sprite.id })
    }

    spriteIds.add(sprite.id)
  }

  return {
    schemaVersion: SPRITE_TABLE_SCHEMA_VERSION,
    id: expectString(object, 'id'),
    name: expectString(object, 'name'),
    textures,
    sprites,
  }
}

export interface SpriteTableLoadResult {
  spriteTable: SpriteTable
  needsUpgrade: boolean
}

export interface SpriteTableLoadManyResult {
  spriteTables: SpriteTable[]
  upgradeManifestPaths: string[]
}

function serializeSpriteTableManifest(spriteTable: SpriteTable): string {
  return `${JSON.stringify(
    {
      ...spriteTable,
      schemaVersion: SPRITE_TABLE_SCHEMA_VERSION,
      textures: spriteTable.textures.map((texture) => ({
        ...texture,
        format: texture.format ?? { container: 'png' },
      })),
    },
    null,
    2,
  )}\n`
}

export class SpriteTableRepository {
  constructor(private readonly storage: ProjectStorage) {}

  async load(manifestPath: string): Promise<SpriteTable> {
    if (!isProjectRelativePath(manifestPath)) {
      throw new SpriteTableFormatError('invalidPath', { path: manifestPath })
    }

    return (await this.loadWithMetadata(manifestPath)).spriteTable
  }

  async loadWithMetadata(manifestPath: string): Promise<SpriteTableLoadResult> {
    if (!isProjectRelativePath(manifestPath)) {
      throw new SpriteTableFormatError('invalidPath', { path: manifestPath })
    }

    const text = await this.storage.readText(manifestPath)
    const spriteTable = parseSpriteTableManifest(text)
    let sourceSchemaVersion: unknown
    try {
      sourceSchemaVersion = (JSON.parse(text) as { schemaVersion?: unknown }).schemaVersion
    } catch {
      sourceSchemaVersion = undefined
    }

    return { spriteTable, needsUpgrade: sourceSchemaVersion === 1 }
  }

  async upgrade(manifestPath: string): Promise<SpriteTableLoadResult> {
    const result = await this.loadWithMetadata(manifestPath)
    if (!result.needsUpgrade) return result

    await this.storage.writeText(manifestPath, serializeSpriteTableManifest(result.spriteTable))
    return { ...result, needsUpgrade: false }
  }

  async loadMany(manifestPaths: string[]): Promise<SpriteTable[]> {
    return (await this.loadManyWithMetadata(manifestPaths)).spriteTables
  }

  async loadManyWithMetadata(manifestPaths: string[]): Promise<SpriteTableLoadManyResult> {
    const loaded = await Promise.all(manifestPaths.map((path) => this.loadWithMetadata(path)))
    const spriteTables = loaded.map(({ spriteTable }) => spriteTable)
    const spriteTableIds = new Set<string>()

    for (const spriteTable of spriteTables) {
      if (spriteTableIds.has(spriteTable.id)) {
        throw new SpriteTableFormatError('duplicateSpriteTableId', { id: spriteTable.id })
      }

      spriteTableIds.add(spriteTable.id)
    }

    return {
      spriteTables,
      upgradeManifestPaths: loaded
        .map((item, index) => (item.needsUpgrade ? manifestPaths[index] : undefined))
        .filter((path): path is string => path !== undefined),
    }
  }
}
