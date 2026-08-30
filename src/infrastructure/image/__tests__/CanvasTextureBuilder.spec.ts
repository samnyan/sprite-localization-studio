import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  LocalizedTextureBuildSpriteError,
  type LocalizedTextureBuildTask,
} from '@/application/build/LocalizedTextureBuild'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { CanvasTextureBuilder } from '@/infrastructure/image/CanvasTextureBuilder'

const task: LocalizedTextureBuildTask = {
  spriteTable: {
    schemaVersion: 1,
    id: 'ui',
    name: 'UI',
    textures: [{ id: 'atlas', imagePath: 'ui.png', size: { width: 64, height: 64 } }],
    sprites: [
      {
        id: 'button',
        name: 'Button',
        textureId: 'atlas',
        frame: { x: 0, y: 0, width: 32, height: 32 },
        rotation: 0,
        trimmed: false,
      },
    ],
  },
  texture: { id: 'atlas', imagePath: 'ui.png', size: { width: 64, height: 64 } },
  translations: [{ spriteTableId: 'ui', spriteId: 'button', textRegions: [] }],
  outputPath: 'output_textures/zh-CN/ui.png',
}

const storage: ProjectStorage = {
  readText: async () => '',
  writeText: async () => undefined,
  readBinary: async () => new ArrayBuffer(0),
  writeBinary: async () => undefined,
  delete: async () => undefined,
  exists: async () => false,
  list: async () => [],
}

interface BuilderInternals {
  loadImage(path: string): Promise<ImageBitmap>
  applyTranslation(): Promise<void>
}

afterEach(() => vi.restoreAllMocks())

describe('CanvasTextureBuilder errors', () => {
  it('adds the sprite identifier only when applying that sprite translation fails', async () => {
    const context = { drawImage: () => undefined } as unknown as CanvasRenderingContext2D
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => context,
    } as unknown as HTMLCanvasElement)

    const builder = new CanvasTextureBuilder(storage, { schemaVersion: 3, name: 'Project' })
    const internals = builder as unknown as BuilderInternals
    vi.spyOn(internals, 'loadImage').mockResolvedValue({ width: 64, height: 64 } as ImageBitmap)
    vi.spyOn(internals, 'applyTranslation').mockRejectedValue(new Error('Background is unavailable.'))

    await expect(builder.buildTexture(task)).rejects.toEqual(
      expect.objectContaining({
        name: 'LocalizedTextureBuildSpriteError',
        spriteId: 'button',
        message: 'Background is unavailable.',
      }),
    )
  })

  it('keeps a source texture load failure at texture scope', async () => {
    const builder = new CanvasTextureBuilder(storage, { schemaVersion: 3, name: 'Project' })
    const internals = builder as unknown as BuilderInternals
    vi.spyOn(internals, 'loadImage').mockRejectedValue(new Error('Source image is unavailable.'))

    const error = await builder.buildTexture(task).then(
      () => undefined,
      (caughtError: unknown) => caughtError,
    )

    expect(error).not.toBeInstanceOf(LocalizedTextureBuildSpriteError)
    expect(error).toMatchObject({ message: 'Source image is unavailable.' })
  })
})
