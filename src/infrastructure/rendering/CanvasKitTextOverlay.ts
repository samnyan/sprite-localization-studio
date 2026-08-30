import type { TextRegion } from '@/domain/text-region/types'
import {
  areCanvasKitTextRegionsSupported,
  CanvasKitTextFallbackError,
  drawTranslationTextWithCanvasKit,
} from '@/infrastructure/rendering/CanvasKitTextRenderer'
import { loadCanvasKit } from '@/infrastructure/rendering/CanvasKitRuntime'

export async function drawCanvasKitTextOverlay(
  target: HTMLCanvasElement,
  regions: TextRegion[],
  shouldCommit: () => boolean = () => true,
): Promise<boolean> {
  if (!areCanvasKitTextRegionsSupported(regions)) return false
  const overlay = document.createElement('canvas')
  overlay.width = target.width
  overlay.height = target.height
  const canvasKit = await loadCanvasKit()
  const surface = canvasKit.MakeSWCanvasSurface(overlay)
  if (!surface) return false
  try {
    surface.getCanvas().clear(canvasKit.TRANSPARENT)
    drawTranslationTextWithCanvasKit(canvasKit, surface.getCanvas(), regions)
    surface.flush()
  } catch (error) {
    if (error instanceof CanvasKitTextFallbackError) return false
    throw error
  } finally {
    surface.dispose()
  }
  if (!shouldCommit()) return false
  const context = target.getContext('2d')
  if (!context) return false
  context.drawImage(overlay, 0, 0)
  return true
}
