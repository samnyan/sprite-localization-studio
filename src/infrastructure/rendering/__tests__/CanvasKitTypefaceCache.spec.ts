import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CanvasKit, Typeface } from 'canvaskit-wasm'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import { projectFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'
import { CanvasKitTypefaceCache } from '@/infrastructure/rendering/CanvasKitTypefaceCache'

function createRuntime(deleted: number[]): CanvasKit {
  return {
    Typeface: {
      GetDefault: () => ({ delete: () => deleted.push(1) }) as unknown as Typeface,
      MakeTypefaceFromData: () => null,
    },
  } as unknown as CanvasKit
}

afterEach(() => vi.restoreAllMocks())

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

  it('does not create or cache a default typeface for a missing explicit project font', () => {
    const getDefault = vi.fn<() => Typeface>()
    const makeTypefaceFromData = vi.fn<(data: ArrayBuffer) => Typeface | null>()
    const runtime = {
      Typeface: { GetDefault: getDefault, MakeTypefaceFromData: makeTypefaceFromData },
    } as unknown as CanvasKit
    vi.spyOn(projectFontRegistry, 'findDataById').mockReturnValue(undefined)
    const cache = new CanvasKitTypefaceCache()
    const config = { ...DEFAULT_TEXT_RENDER, fontId: 'missing-font' }

    expect(cache.resolve(runtime, config)).toBeUndefined()
    expect(cache.resolve(runtime, config)).toBeUndefined()
    expect(getDefault).not.toHaveBeenCalled()
    expect(makeTypefaceFromData).not.toHaveBeenCalled()
  })

  it('uses the exact explicit project font data', () => {
    const data = new ArrayBuffer(8)
    const typeface = { delete: () => undefined } as unknown as Typeface
    const makeTypefaceFromData = vi.fn<(value: ArrayBuffer) => Typeface | null>(() => typeface)
    const runtime = {
      Typeface: { GetDefault: vi.fn<() => Typeface>(), MakeTypefaceFromData: makeTypefaceFromData },
    } as unknown as CanvasKit
    vi.spyOn(projectFontRegistry, 'findDataById').mockReturnValue(data)
    const cache = new CanvasKitTypefaceCache()

    expect(cache.resolve(runtime, { ...DEFAULT_TEXT_RENDER, fontId: 'project-font' })).toBe(typeface)
    expect(makeTypefaceFromData).toHaveBeenCalledWith(data)
  })
})
