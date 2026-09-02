import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import {
  areCanvasKitTextRegionsSupported,
  drawTextRegionWithCanvasKit,
  isCanvasKitTextRegionSupported,
  isCanvasKitTextRenderSupported,
} from '@/infrastructure/rendering/CanvasKitTextRenderer'
import { projectFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'
import { canvasKitTypefaceCache } from '@/infrastructure/rendering/CanvasKitTypefaceCache'

afterEach(() => vi.restoreAllMocks())

describe('isCanvasKitTextRenderSupported', () => {
  it('keeps the generic default style on the CanvasKit path', () => {
    expect(isCanvasKitTextRenderSupported(DEFAULT_TEXT_RENDER)).toBe(true)
  })

  it('falls back when a system font has no project font binary', () => {
    expect(isCanvasKitTextRenderSupported({ ...DEFAULT_TEXT_RENDER, fontFamily: 'Arial' })).toBe(false)
  })

  it('does not hide a missing explicit project font behind a matching family', () => {
    const byId = vi.spyOn(projectFontRegistry, 'findDataById').mockReturnValue(undefined)
    const byDescriptor = vi.spyOn(projectFontRegistry, 'findData').mockReturnValue(new ArrayBuffer(8))

    expect(isCanvasKitTextRenderSupported({ ...DEFAULT_TEXT_RENDER, fontId: 'missing-font' })).toBe(false)
    expect(byId).toHaveBeenCalledWith('missing-font')
    expect(byDescriptor).not.toHaveBeenCalled()
  })

  it('falls back for styles that require Canvas 2D parity', () => {
    expect(isCanvasKitTextRenderSupported({
      ...DEFAULT_TEXT_RENDER,
      stroke: { width: 2, position: 'inside', paint: { mode: 'solid', color: '#000000' } },
    })).toBe(false)
    expect(isCanvasKitTextRenderSupported({
      ...DEFAULT_TEXT_RENDER,
      fill: { mode: 'solid', color: 'red' },
    })).toBe(false)
  })

  it('keeps complex scripts off the simple CanvasKit text path', () => {
    expect(isCanvasKitTextRegionSupported('مرحبا بالعالم', DEFAULT_TEXT_RENDER)).toBe(false)
    expect(isCanvasKitTextRegionSupported('Hello world', DEFAULT_TEXT_RENDER)).toBe(true)
  })

  it('rejects the whole region set before CanvasKit drawing starts', () => {
    const region = {
      id: 'title',
      rect: { x: 0, y: 0, width: 200, height: 80 },
      rotation: 0,
      translationKey: 'title',
      translatedText: 'مرحبا بالعالم',
    }

    expect(areCanvasKitTextRegionsSupported([region])).toBe(false)
    expect(() => drawTextRegionWithCanvasKit(
      {} as never,
      {} as never,
      region.translatedText,
      region,
      DEFAULT_TEXT_RENDER,
    )).toThrow('CanvasKit text region is unsupported.')
  })

  it('shapes eligible complex text with a project-font paragraph', () => {
    vi.spyOn(projectFontRegistry, 'findData').mockReturnValue(new ArrayBuffer(8))
    const calls: string[] = []
    let direction: number | undefined
    const paragraph = {
      delete: () => calls.push('paragraph.delete'),
      getHeight: () => 30,
      layout: () => calls.push('paragraph.layout'),
      unresolvedCodepoints: () => [],
    }
    const builder = {
      addText: () => calls.push('builder.addText'),
      build: () => paragraph,
      delete: () => calls.push('builder.delete'),
    }
    const provider = {
      delete: () => calls.push('provider.delete'),
      registerFont: () => calls.push('provider.registerFont'),
    }
    const canvas = {
      drawParagraph: () => calls.push('canvas.drawParagraph'),
      restore: () => calls.push('canvas.restore'),
      rotate: () => calls.push('canvas.rotate'),
      save: () => calls.push('canvas.save'),
      translate: () => calls.push('canvas.translate'),
    }
    const canvasKit = {
      ClipOp: { Intersect: 0 },
      Color4f: () => [],
      LTRBRect: () => [],
      ParagraphBuilder: { MakeFromFontProvider: (style: { textDirection?: number }) => {
        direction = style.textDirection
        return builder
      } },
      TextAlign: { Center: 0, Left: 0, Right: 0 },
      TextDirection: { LTR: 1, RTL: 2 },
      TypefaceFontProvider: { Make: () => provider },
    }
    const region = {
      id: 'title', rect: { x: 0, y: 0, width: 200, height: 80 }, rotation: 0, translationKey: 'title',
    }
    const render = { ...DEFAULT_TEXT_RENDER, fontFamily: 'Demo', wrap: true }

    drawTextRegionWithCanvasKit(canvasKit as never, canvas as never, 'مرحبا', region, render)

    expect(calls).toEqual([
      'provider.registerFont', 'builder.addText', 'paragraph.layout', 'canvas.save',
      'canvas.translate', 'canvas.rotate', 'canvas.drawParagraph', 'canvas.restore',
      'paragraph.delete', 'builder.delete', 'provider.delete',
    ])
    expect(direction).toBe(2)
  })

  it('stops before drawing and releases paragraph resources for unresolved glyphs', () => {
    vi.spyOn(projectFontRegistry, 'findData').mockReturnValue(new ArrayBuffer(8))
    const calls: string[] = []
    const paragraph = {
      delete: () => calls.push('paragraph.delete'),
      getHeight: () => 30,
      layout: () => calls.push('paragraph.layout'),
      unresolvedCodepoints: () => [0x0627],
    }
    const builder = {
      addText: () => calls.push('builder.addText'),
      build: () => paragraph,
      delete: () => calls.push('builder.delete'),
    }
    const provider = {
      delete: () => calls.push('provider.delete'),
      registerFont: () => calls.push('provider.registerFont'),
    }
    const canvasKit = {
      Color4f: () => [],
      ParagraphBuilder: { MakeFromFontProvider: () => builder },
      TextAlign: { Center: 0, Left: 0, Right: 0 },
      TextDirection: { LTR: 0, RTL: 0 },
      TypefaceFontProvider: { Make: () => provider },
    }
    const canvas = { drawParagraph: () => calls.push('canvas.drawParagraph') }
    const region = {
      id: 'title', rect: { x: 0, y: 0, width: 200, height: 80 }, rotation: 0, translationKey: 'title',
    }
    const render = { ...DEFAULT_TEXT_RENDER, fontFamily: 'Demo', wrap: true }

    expect(() => drawTextRegionWithCanvasKit(
      canvasKit as never,
      canvas as never,
      'مرحبا',
      region,
      render,
    )).toThrow('CanvasKit paragraph has unresolved glyphs.')
    expect(calls).toEqual([
      'provider.registerFont', 'builder.addText', 'paragraph.layout',
      'paragraph.delete', 'builder.delete', 'provider.delete',
    ])
  })

  it('falls back before direct CanvasKit text drawing when a glyph is unavailable', () => {
    const calls: string[] = []
    vi.spyOn(canvasKitTypefaceCache, 'resolve').mockReturnValue({} as never)
    const font = {
      delete: () => calls.push('font.delete'),
      getGlyphIDs: () => [12, 0],
      getGlyphWidths: () => [10, 10],
      setSize: () => undefined,
    }
    const canvasKit = {
      Font: class {
        constructor() {
          return font
        }
      },
    }
    const region = {
      id: 'title', rect: { x: 0, y: 0, width: 200, height: 80 }, rotation: 0, translationKey: 'title',
    }

    expect(() => drawTextRegionWithCanvasKit(
      canvasKit as never,
      {} as never,
      'Missing glyph',
      region,
      DEFAULT_TEXT_RENDER,
    )).toThrow('CanvasKit text has unresolved glyphs.')
    expect(calls).toEqual(['font.delete'])
  })

  it('applies the configured outline join to the CanvasKit stroke paint', () => {
    vi.spyOn(canvasKitTypefaceCache, 'resolve').mockReturnValue({} as never)
    const joins: unknown[] = []
    const font = {
      delete: () => undefined,
      getGlyphIDs: () => [12],
      getGlyphWidths: () => [10],
      getMetrics: () => ({ ascent: -8, descent: 2 }),
      setSize: () => undefined,
    }
    const canvasKit = {
      Color4f: () => [],
      Font: class { constructor() { return font } },
      Paint: class {
        delete() {}
        setAntiAlias() {}
        setColor() {}
        setStrokeJoin(join: unknown) { joins.push(join) }
        setStrokeWidth() {}
        setStyle() {}
      },
      PaintStyle: { Stroke: 'stroke' },
      StrokeJoin: { Bevel: 'bevel', Miter: 'miter', Round: 'round' },
    }
    const canvas = {
      drawText: () => undefined,
      restore: () => undefined,
      rotate: () => undefined,
      save: () => undefined,
      translate: () => undefined,
    }
    const region = {
      id: 'title', rect: { x: 0, y: 0, width: 200, height: 80 }, rotation: 0, translationKey: 'title',
    }

    drawTextRegionWithCanvasKit(canvasKit as never, canvas as never, 'A', region, {
      ...DEFAULT_TEXT_RENDER,
      stroke: { width: 2, position: 'outside', join: 'bevel', paint: { mode: 'solid', color: '#000000' } },
    })

    expect(joins).toEqual(['bevel'])
  })

  it('does not treat layout-only newline controls as unresolved glyphs', () => {
    vi.spyOn(canvasKitTypefaceCache, 'resolve').mockReturnValue({} as never)
    const requested: string[] = []
    const font = {
      delete: () => undefined,
      getGlyphIDs: (text: string) => {
        requested.push(text)
        return text.includes('\n') ? [0] : [12]
      },
      getGlyphWidths: () => [10],
      getMetrics: () => ({ ascent: -8, descent: 2 }),
      setSize: () => undefined,
    }
    const canvasKit = {
      Color4f: () => [],
      Font: class { constructor() { return font } },
      Paint: class { delete() {} setAntiAlias() {} setColor() {} },
    }
    const canvas = {
      drawText: () => undefined,
      restore: () => undefined,
      rotate: () => undefined,
      save: () => undefined,
      translate: () => undefined,
    }
    const region = { id: 'title', rect: { x: 0, y: 0, width: 200, height: 80 }, rotation: 0, translationKey: 'title' }

    expect(() => drawTextRegionWithCanvasKit(canvasKit as never, canvas as never, 'A\nB', region, DEFAULT_TEXT_RENDER)).not.toThrow()
    expect(requested).not.toContain('A\nB')
  })

  it('falls back when layout adds an ellipsis whose glyph is unavailable', () => {
    const calls: string[] = []
    vi.spyOn(canvasKitTypefaceCache, 'resolve').mockReturnValue({} as never)
    const font = {
      delete: () => calls.push('font.delete'),
      getGlyphIDs: (text: string) => text.includes('…') ? [0] : Array.from(text, () => 12),
      getGlyphWidths: (glyphs: number[]) => glyphs.map(() => 10),
      setSize: () => undefined,
    }
    const canvasKit = { Font: class { constructor() { return font } } }
    const region = { id: 'title', rect: { x: 0, y: 0, width: 15, height: 80 }, rotation: 0, translationKey: 'title' }

    expect(() => drawTextRegionWithCanvasKit(
      canvasKit as never,
      {} as never,
      'ABCD',
      region,
      { ...DEFAULT_TEXT_RENDER, overflow: 'ellipsis' },
    )).toThrow('CanvasKit text has unresolved glyphs.')
    expect(calls).toEqual(['font.delete'])
  })
})
