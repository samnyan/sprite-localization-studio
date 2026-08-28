import type { CanvasKit, Typeface } from 'canvaskit-wasm'

import type { TextRenderConfig } from '@/domain/text-region/types'
import { projectFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'

export class CanvasKitTypefaceCache {
  private runtime: CanvasKit | undefined
  private fontVersion = -1
  private readonly typefaces = new Map<string, Typeface>()

  resolve(canvasKit: CanvasKit, config: TextRenderConfig): Typeface | undefined {
    if (this.runtime !== canvasKit || this.fontVersion !== projectFontRegistry.version) {
      this.dispose()
      this.runtime = canvasKit
      this.fontVersion = projectFontRegistry.version
    }
    const key = `${config.fontFamily}\u0000${config.fontWeight}\u0000${config.fontStyle ?? 'normal'}`
    const cached = this.typefaces.get(key)
    if (cached) return cached
    const data = projectFontRegistry.findData(
      config.fontFamily,
      config.fontWeight,
      config.fontStyle ?? 'normal',
    )
    const typeface = data ? canvasKit.Typeface.MakeTypefaceFromData(data) : canvasKit.Typeface.GetDefault()
    if (!typeface) return undefined
    this.typefaces.set(key, typeface)
    return typeface
  }

  dispose(): void {
    for (const typeface of this.typefaces.values()) typeface.delete()
    this.typefaces.clear()
  }
}

export const canvasKitTypefaceCache = new CanvasKitTypefaceCache()
