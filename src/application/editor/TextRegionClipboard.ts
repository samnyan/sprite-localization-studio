import type { Size } from '@/domain/shared/geometry'
import type { TextRegion } from '@/domain/text-region/types'

interface TextRegionClipboardSource {
  spriteTableId: string
  spriteId: string
}

interface PasteTarget extends TextRegionClipboardSource {
  bounds: Size
  id: string
  translationKey: string
}

function cloneRegion(region: TextRegion): TextRegion {
  return JSON.parse(JSON.stringify(region)) as TextRegion
}

function constrainRect(region: TextRegion, bounds: Size, offset: number): TextRegion['rect'] {
  const width = Math.min(region.rect.width, bounds.width)
  const height = Math.min(region.rect.height, bounds.height)
  const maxX = bounds.width - width
  const maxY = bounds.height - height
  const x = (Math.max(0, Math.min(region.rect.x, maxX)) + offset) % (maxX + 1)
  const y = (Math.max(0, Math.min(region.rect.y, maxY)) + offset) % (maxY + 1)
  return { x, y, width, height }
}

export class TextRegionClipboard {
  private copied?: { source: TextRegionClipboardSource; region: TextRegion }
  private pasteCount = 0

  get hasRegion(): boolean {
    return this.copied !== undefined
  }

  clear(): void {
    this.copied = undefined
    this.pasteCount = 0
  }

  copy(source: TextRegionClipboardSource, region: TextRegion): void {
    this.copied = { source, region: cloneRegion(region) }
    this.pasteCount = 0
  }

  paste(target: PasteTarget): TextRegion | undefined {
    const copied = this.copied
    if (!copied) return undefined

    const sameSprite =
      copied.source.spriteTableId === target.spriteTableId && copied.source.spriteId === target.spriteId
    const offset = sameSprite ? 10 * ++this.pasteCount : 0
    const region = cloneRegion(copied.region)
    return {
      ...region,
      id: target.id,
      translationKey: target.translationKey,
      rect: constrainRect(region, target.bounds, offset),
    }
  }
}
