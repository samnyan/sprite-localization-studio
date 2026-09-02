import type { Canvas, CanvasKit } from 'canvaskit-wasm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TextRegion } from '@/domain/text-region/types'
import { drawCanvasKitTextOverlay } from '@/infrastructure/rendering/CanvasKitTextOverlay'
import {
  areCanvasKitTextRegionsSupported,
  CanvasKitTextFallbackError,
  drawTranslationTextWithCanvasKit,
} from '@/infrastructure/rendering/CanvasKitTextRenderer'
import { loadCanvasKit } from '@/infrastructure/rendering/CanvasKitRuntime'

vi.mock('@/infrastructure/rendering/CanvasKitRuntime', () => ({
  loadCanvasKit: vi.fn<() => Promise<CanvasKit>>(),
}))

vi.mock('@/infrastructure/rendering/CanvasKitTextRenderer', () => {
  class CanvasKitTextFallbackError extends Error {}
  return {
    areCanvasKitTextRegionsSupported: vi.fn<(regions: TextRegion[]) => boolean>(() => true),
    CanvasKitTextFallbackError,
    drawTranslationTextWithCanvasKit: vi.fn<
      (canvasKit: CanvasKit, canvas: Canvas, regions: TextRegion[]) => void
    >(),
  }
})

interface SurfaceFixture {
  canvas: { clear(color: unknown): void }
  dispose(): void
  flush(): void
  getCanvas(): SurfaceFixture['canvas']
}

function createRuntime(surface: SurfaceFixture | null): CanvasKit {
  return {
    MakeSWCanvasSurface: () => surface,
    TRANSPARENT: [0, 0, 0, 0],
  } as unknown as CanvasKit
}

function createSurface(calls: string[]): SurfaceFixture {
  return {
    canvas: { clear: () => calls.push('canvas.clear') },
    dispose: () => calls.push('surface.dispose'),
    flush: () => calls.push('surface.flush'),
    getCanvas() { return this.canvas },
  }
}

function createTarget(calls: string[]): HTMLCanvasElement {
  return {
    width: 320,
    height: 180,
    getContext: () => {
      calls.push('target.getContext')
      return { drawImage: () => calls.push('target.drawImage') }
    },
  } as unknown as HTMLCanvasElement
}

function prepareRenderer(calls: string[], error?: Error): void {
  vi.mocked(areCanvasKitTextRegionsSupported).mockReturnValue(true)
  vi.mocked(drawTranslationTextWithCanvasKit).mockImplementation(() => {
    calls.push('renderer.draw')
    if (error) throw error
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(areCanvasKitTextRegionsSupported).mockReset()
  vi.mocked(drawTranslationTextWithCanvasKit).mockReset()
  vi.mocked(loadCanvasKit).mockReset()
})

describe('drawCanvasKitTextOverlay', () => {
  it('flushes, disposes, and commits the completed overlay in order', async () => {
    const calls: string[] = []
    const overlay = { width: 0, height: 0 }
    vi.spyOn(document, 'createElement').mockReturnValue(overlay as unknown as HTMLElement)
    vi.mocked(loadCanvasKit).mockResolvedValue(createRuntime(createSurface(calls)))
    prepareRenderer(calls)

    await expect(drawCanvasKitTextOverlay(createTarget(calls), [])).resolves.toEqual({
      rendered: true,
      renderer: 'canvaskit',
    })

    expect(overlay).toMatchObject({ width: 320, height: 180 })
    expect(calls).toEqual([
      'canvas.clear',
      'renderer.draw',
      'surface.flush',
      'surface.dispose',
      'target.getContext',
      'target.drawImage',
    ])
  })

  it('disposes a rendered overlay before rejecting an obsolete result', async () => {
    const calls: string[] = []
    vi.spyOn(document, 'createElement').mockReturnValue({} as HTMLElement)
    vi.mocked(loadCanvasKit).mockResolvedValue(createRuntime(createSurface(calls)))
    prepareRenderer(calls)

    await expect(drawCanvasKitTextOverlay(createTarget(calls), [], () => {
      calls.push('shouldCommit')
      return false
    })).resolves.toEqual({ rendered: false, renderer: 'canvas' })

    expect(calls).toEqual([
      'canvas.clear',
      'renderer.draw',
      'surface.flush',
      'surface.dispose',
      'shouldCommit',
    ])
  })

  it('falls back atomically and disposes the surface for a CanvasKit text fallback', async () => {
    const calls: string[] = []
    vi.spyOn(document, 'createElement').mockReturnValue({} as HTMLElement)
    vi.mocked(loadCanvasKit).mockResolvedValue(createRuntime(createSurface(calls)))
    prepareRenderer(calls, new CanvasKitTextFallbackError('Glyph is unavailable.'))

    await expect(drawCanvasKitTextOverlay(createTarget(calls), [])).resolves.toEqual({
      rendered: false,
      renderer: 'canvas',
      fallbackReason: 'text-fallback',
    })

    expect(calls).toEqual(['canvas.clear', 'renderer.draw', 'surface.dispose'])
  })

  it('rethrows a non-fallback rendering error after disposing the surface', async () => {
    const calls: string[] = []
    vi.spyOn(document, 'createElement').mockReturnValue({} as HTMLElement)
    vi.mocked(loadCanvasKit).mockResolvedValue(createRuntime(createSurface(calls)))
    prepareRenderer(calls, new Error('Canvas clear failed.'))

    await expect(drawCanvasKitTextOverlay(createTarget(calls), [])).rejects.toThrow(
      'Canvas clear failed.',
    )

    expect(calls).toEqual(['canvas.clear', 'renderer.draw', 'surface.dispose'])
  })

  it('does not render or dispose when CanvasKit cannot create a surface', async () => {
    const calls: string[] = []
    vi.spyOn(document, 'createElement').mockReturnValue({} as HTMLElement)
    vi.mocked(loadCanvasKit).mockResolvedValue(createRuntime(null))
    prepareRenderer(calls)

    await expect(drawCanvasKitTextOverlay(createTarget(calls), [])).resolves.toEqual({
      rendered: false,
      renderer: 'canvas',
      fallbackReason: 'surface-unavailable',
    })

    expect(calls).toEqual([])
  })
})
