import {
  LocalizedTextureBuildSpriteError,
  type BuiltTexture,
  type LocalizedTextureBuilder,
  type LocalizedTextureBuildTask,
} from '@/application/build/LocalizedTextureBuild'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import type { ProjectManifest } from '@/domain/project/types'
import type { Sprite } from '@/domain/sprite/types'
import { resolveBackgroundType, type SpriteTranslation } from '@/domain/text-region/types'
import { drawTranslationText } from '@/infrastructure/image/textRenderer'
import { drawCanvasKitTextOverlay } from '@/infrastructure/rendering/CanvasKitTextOverlay'
import {
  getLogicalSpriteSize,
  getLogicalToStoredTransform,
  getLogicalTrimmedSize,
  getStoredToLogicalTransform,
} from '@/infrastructure/image/spriteGeometry'

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D rendering is unavailable.')
  return context
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG encoding failed.'))
        return
      }
      void blob.arrayBuffer().then(
        (data) => resolve(new Uint8Array(data)),
        (error: unknown) => reject(error),
      )
    }, 'image/png')
  })
}

function drawStoredSprite(
  context: CanvasRenderingContext2D,
  texture: ImageBitmap,
  sprite: Sprite,
): void {
  const storedSize = getLogicalTrimmedSize(sprite)
  const extracted = createCanvas(storedSize.width, storedSize.height)
  const extractedContext = getContext(extracted)
  const transform = getStoredToLogicalTransform(sprite)
  extractedContext.setTransform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  )
  extractedContext.drawImage(
    texture,
    sprite.frame.x,
    sprite.frame.y,
    sprite.frame.width,
    sprite.frame.height,
    0,
    0,
    sprite.frame.width,
    sprite.frame.height,
  )
  context.drawImage(extracted, sprite.trimOffset?.x ?? 0, sprite.trimOffset?.y ?? 0)
}

function storeLogicalSprite(
  textureContext: CanvasRenderingContext2D,
  logicalSprite: HTMLCanvasElement,
  sprite: Sprite,
): void {
  const storedSize = getLogicalTrimmedSize(sprite)
  const trimmed = createCanvas(storedSize.width, storedSize.height)
  getContext(trimmed).drawImage(
    logicalSprite,
    sprite.trimOffset?.x ?? 0,
    sprite.trimOffset?.y ?? 0,
    storedSize.width,
    storedSize.height,
    0,
    0,
    storedSize.width,
    storedSize.height,
  )

  const stored = createCanvas(sprite.frame.width, sprite.frame.height)
  const storedContext = getContext(stored)
  const transform = getLogicalToStoredTransform(sprite)
  storedContext.setTransform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  )
  storedContext.drawImage(trimmed, 0, 0)
  textureContext.clearRect(sprite.frame.x, sprite.frame.y, sprite.frame.width, sprite.frame.height)
  textureContext.drawImage(stored, sprite.frame.x, sprite.frame.y)
}

function describeSpriteGeometry(sprite: Sprite): string {
  const logicalSize = getLogicalSpriteSize(sprite)
  const storedSize = getLogicalTrimmedSize(sprite)
  const transform = getLogicalToStoredTransform(sprite)
  const trimOffset = sprite.trimOffset ?? { x: 0, y: 0 }
  return [
    `logical=${logicalSize.width}x${logicalSize.height}`,
    `trimmed=${storedSize.width}x${storedSize.height}@${trimOffset.x},${trimOffset.y}`,
    `frame=${sprite.frame.x},${sprite.frame.y},${sprite.frame.width}x${sprite.frame.height}`,
    `rotation=${sprite.rotation}`,
    `logicalToStored=[${transform.a},${transform.b},${transform.c},${transform.d},${transform.e},${transform.f}]`,
  ].join(' ')
}

export class CanvasTextureBuilder implements LocalizedTextureBuilder {
  private readonly imageCache = new Map<string, ImageBitmap>()

  constructor(
    private readonly storage: ProjectStorage,
    private readonly project: ProjectManifest,
  ) {}

  async buildTexture(task: LocalizedTextureBuildTask): Promise<BuiltTexture> {
    try {
      const source = await this.loadImage(`textures/${task.texture.imagePath}`)
      if (source.width !== task.texture.size.width || source.height !== task.texture.size.height) {
        throw new Error(`Texture size mismatch: ${task.texture.imagePath}`)
      }

      const output = createCanvas(source.width, source.height)
      const outputContext = getContext(output)
      outputContext.drawImage(source, 0, 0)

      for (const translation of task.translations) {
        const sprite = task.spriteTable.sprites.find(
          (item) => item.id === translation.spriteId && item.textureId === task.texture.id,
        )
        if (!sprite) continue

        try {
          await this.applyTranslation(outputContext, source, sprite, translation, task.outputPath)
        } catch (error) {
          throw new LocalizedTextureBuildSpriteError(
            error instanceof Error ? error.message : String(error),
            sprite.id,
          )
        }
      }

      await this.storage.writeBinary(task.outputPath, await canvasToPng(output))
      return { outputPath: task.outputPath, modifiedSpriteCount: task.translations.length }
    } finally {
      this.disposeImages()
    }
  }

  private async applyTranslation(
    outputContext: CanvasRenderingContext2D,
    source: ImageBitmap,
    sprite: Sprite,
    translation: SpriteTranslation,
    outputPath: string,
  ): Promise<void> {
    const logicalSize = getLogicalSpriteSize(sprite)
    const logical = createCanvas(logicalSize.width, logicalSize.height)
    const logicalContext = getContext(logical)

    const backgroundType = resolveBackgroundType(translation)
    if (backgroundType === 'template' || backgroundType === 'sprite') {
      const background = await this.loadBackground(translation)
      logicalContext.drawImage(background, 0, 0, logicalSize.width, logicalSize.height)
    } else if (backgroundType !== 'blank') {
      drawStoredSprite(logicalContext, source, sprite)
    }

    try {
      const result = await drawCanvasKitTextOverlay(logical, translation.textRegions)
      if (!result.rendered) {
        drawTranslationText(logicalContext, translation.textRegions)
      }
      console.debug(
        `[Texture build] output=${outputPath} sprite=${sprite.id} renderer=${result.renderer}` +
          `${result.fallbackReason ? ` (${result.fallbackReason})` : ''} ${describeSpriteGeometry(sprite)}`,
      )
    } catch (error) {
      console.warn(
        `[Texture build] output=${outputPath} sprite=${sprite.id} CanvasKit error; falling back to Canvas2D.`,
        error,
      )
      drawTranslationText(logicalContext, translation.textRegions)
      console.debug(
        `[Texture build] output=${outputPath} sprite=${sprite.id} renderer=canvas (canvaskit-error) ${describeSpriteGeometry(sprite)}`,
      )
    }
    storeLogicalSprite(outputContext, logical, sprite)
    console.debug(
      `[Texture build] output=${outputPath} sprite=${sprite.id} writeback complete ${describeSpriteGeometry(sprite)}`,
    )
  }

  private async loadBackground(translation: SpriteTranslation): Promise<ImageBitmap> {
    const backgrounds =
      resolveBackgroundType(translation) === 'sprite'
        ? this.project.spriteBackgrounds
        : this.project.backgroundTemplates
    const background = backgrounds?.find(
      (item) =>
        item.id === translation.backgroundId &&
        (resolveBackgroundType(translation) !== 'sprite' ||
          (item.scope === 'sprite' &&
            item.spriteTableId === translation.spriteTableId &&
            item.spriteId === translation.spriteId)),
    )
    if (!background) throw new Error(`Missing background: ${translation.backgroundId ?? 'unknown'}`)
    return this.loadImage(background.path)
  }

  private async loadImage(path: string): Promise<ImageBitmap> {
    const cached = this.imageCache.get(path)
    if (cached) return cached
    const data = await this.storage.readBinary(path)
    const image = await createImageBitmap(new Blob([data]))
    this.imageCache.set(path, image)
    return image
  }

  private disposeImages(): void {
    for (const image of this.imageCache.values()) image.close()
    this.imageCache.clear()
  }
}
