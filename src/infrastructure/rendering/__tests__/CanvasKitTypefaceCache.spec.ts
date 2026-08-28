import { describe, expect, it } from 'vitest'
import type { CanvasKit, Typeface } from 'canvaskit-wasm'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import { CanvasKitTypefaceCache } from '@/infrastructure/rendering/CanvasKitTypefaceCache'

function createRuntime(deleted: number[]): CanvasKit {
  return {
    Typeface: {
      GetDefault: () => ({ delete: () => deleted.push(1) }) as unknown as Typeface,
      MakeTypefaceFromData: () => null,
    },
  } as unknown as CanvasKit
}

describe('CanvasKitTypefaceCache', () => {
  it('reuses a typeface and releases it once when the runtime changes', () => {
    const deleted: number[] = []
    const cache = new CanvasKitTypefaceCache()
    const firstRuntime = createRuntime(deleted)
    const secondRuntime = createRuntime(deleted)

    expect(cache.resolve(firstRuntime, DEFAULT_TEXT_RENDER)).toBe(
      cache.resolve(firstRuntime, DEFAULT_TEXT_RENDER),
    )
    expect(deleted).toHaveLength(0)
    cache.resolve(secondRuntime, DEFAULT_TEXT_RENDER)
    expect(deleted).toHaveLength(1)
    cache.dispose()
    expect(deleted).toHaveLength(2)
  })
})
