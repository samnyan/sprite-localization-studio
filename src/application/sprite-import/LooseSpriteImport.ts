import { isProjectRelativePath } from '@/application/storage/projectPath'
import type { Size } from '@/domain/shared/geometry'
import {
  SPRITE_TABLE_SCHEMA_VERSION,
  type SpriteTable,
} from '@/domain/sprite-table/types'

export interface LooseSpriteImage {
  name: string
  size: Size
}

export interface LooseSpriteImportPlan {
  manifestPath: string
  spriteTable: SpriteTable
}

export function isLooseSpriteImage(name: string): boolean {
  return name.toLocaleLowerCase().endsWith('.png')
}

function fileStem(name: string): string {
  return name.slice(0, -4)
}

function assertImportPath(directoryName: string, imageName?: string): void {
  const path = imageName ? `${directoryName}/${imageName}` : directoryName
  if (!isProjectRelativePath(path)) throw new Error(`Invalid loose sprite import path: ${path}`)
}

export function createLooseSpriteImportPlan(
  directoryName: string,
  images: LooseSpriteImage[],
): LooseSpriteImportPlan {
  assertImportPath(directoryName)
  if (!images.length) throw new Error('No PNG images were selected for import.')

  const names = new Set<string>()
  const spriteIds = new Set<string>()
  for (const image of images) {
    assertImportPath(directoryName, image.name)
    if (!isLooseSpriteImage(image.name) || !Number.isInteger(image.size.width) || !Number.isInteger(image.size.height) || image.size.width < 1 || image.size.height < 1) {
      throw new Error(`Invalid loose sprite image: ${image.name}`)
    }
    const id = fileStem(image.name)
    if (!id || names.has(image.name) || spriteIds.has(id)) {
      throw new Error(`Duplicate loose sprite image: ${image.name}`)
    }
    names.add(image.name)
    spriteIds.add(id)
  }

  return {
    manifestPath: `manifests/${encodeURIComponent(directoryName)}.sprite-table.json`,
    spriteTable: {
      schemaVersion: SPRITE_TABLE_SCHEMA_VERSION,
      id: directoryName,
      name: directoryName,
      textures: images.map((image) => ({
        id: fileStem(image.name),
        imagePath: `${directoryName}/${image.name}`,
        size: image.size,
      })),
      sprites: images.map((image) => {
        const id = fileStem(image.name)
        return {
          id,
          name: id,
          textureId: id,
          frame: { x: 0, y: 0, width: image.size.width, height: image.size.height },
          rotation: 0,
          trimmed: false,
        }
      }),
    },
  }
}
