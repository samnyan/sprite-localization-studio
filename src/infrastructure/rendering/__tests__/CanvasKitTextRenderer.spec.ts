import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import {
  areCanvasKitTextRegionsSupported,
  drawTextRegionWithCanvasKit,
  isCanvasKitTextRegionSupported,
  isCanvasKitTextRenderSupported,
} from '@/infrastructure/rendering/CanvasKitTextRenderer'
import { projectFontRegistry } from '@/infrastructure/font/BrowserFontRegistry'

afterEach(() => vi.restoreAllMocks())

describe('isCanvasKitTextRenderSupported', () => {
  it('keeps the generic default style on the CanvasKit path', () => {
    expect(isCanvasKitTextRenderSupported(DEFAULT_TEXT_RENDER)).toBe(true)
  })

  it('falls back when a system font has no project font binary', () => {
    expect(isCanvasKitTextRenderSupported({ ...DEFAULT_TEXT_RENDER, fontFamily: 'Arial' })).toBe(false)
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
})
