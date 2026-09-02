import type { TextRegion } from '@/domain/text-region/types'
import {
  areCanvasKitTextRegionsSupported,
  CanvasKitTextFallbackError,
  drawTranslationTextWithCanvasKit,
} from '@/infrastructure/rendering/CanvasKitTextRenderer'
import { loadCanvasKit } from '@/infrastructure/rendering/CanvasKitRuntime'

export type TextOverlayRenderer = 'canvaskit' | 'canvas'

export interface TextOverlayRenderResult {
  rendered: boolean
  renderer: TextOverlayRenderer
  fallbackReason?: 'unsupported' | 'surface-unavailable' | 'text-fallback' | 'context-unavailable'
}

export async function drawCanvasKitTextOverlay(
  target: HTMLCanvasElement,
  regions: TextRegion[],
  shouldCommit: () => boolean = () => true,
): Promise<TextOverlayRenderResult> {
  if (!areCanvasKitTextRegionsSupported(regions)) {
    return { rendered: false, renderer: 'canvas', fallbackReason: 'unsupported' }
  }
  const overlay = document.createElement('canvas')
  overlay.width = target.width
  overlay.height = target.height
  const canvasKit = await loadCanvasKit()
  const surface = canvasKit.MakeSWCanvasSurface(overlay)
  if (!surface) return { rendered: false, renderer: 'canvas', fallbackReason: 'surface-unavailable' }
  try {
    surface.getCanvas().clear(canvasKit.TRANSPARENT)
    drawTranslationTextWithCanvasKit(canvasKit, surface.getCanvas(), regions)
    surface.flush()
  } catch (error) {
    if (error instanceof CanvasKitTextFallbackError) {
      return { rendered: false, renderer: 'canvas', fallbackReason: 'text-fallback' }
    }
    throw error
  } finally {
    surface.dispose()
  }
  if (!shouldCommit()) return { rendered: false, renderer: 'canvas' }
  const context = target.getContext('2d')
  if (!context) {
    return { rendered: false, renderer: 'canvas', fallbackReason: 'context-unavailable' }
  }
  context.drawImage(overlay, 0, 0)
  return { rendered: true, renderer: 'canvaskit' }
}
