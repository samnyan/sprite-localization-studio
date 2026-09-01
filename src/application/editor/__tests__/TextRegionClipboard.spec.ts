import { describe, expect, it } from 'vitest'

import { TextRegionClipboard } from '@/application/editor/TextRegionClipboard'
import type { TextRegion } from '@/domain/text-region/types'

function region(): TextRegion {
  return {
    id: 'source',
    translationKey: 'ui.button.1',
    rect: { x: 2, y: 3, width: 20, height: 15 },
    rotation: 15,
    styleId: 'style',
    translatedText: 'Start',
    render: {
      fontFamily: 'Game Font',
      fontSize: 24,
      fontWeight: 700,
      color: '#ffffff',
      align: 'left',
      fill: {
        mode: 'gradient',
        color: '#ffffff',
        gradientStops: [{ color: '#ffffff', position: 0 }, { color: '#000000', position: 1 }],
      },
    },
  }
}

describe('TextRegionClipboard', () => {
  it('deep-copies a region and cascades repeated pastes on the source sprite', () => {
    const clipboard = new TextRegionClipboard()
    const source = region()
    clipboard.copy({ spriteTableId: 'ui', spriteId: 'button' }, source)
    source.render!.fill!.gradientStops![0]!.color = '#ff0000'

    const first = clipboard.paste({
      spriteTableId: 'ui',
      spriteId: 'button',
      bounds: { width: 100, height: 100 },
      id: 'first',
      translationKey: 'ui.button.2',
    })
    const second = clipboard.paste({
      spriteTableId: 'ui',
      spriteId: 'button',
      bounds: { width: 100, height: 100 },
      id: 'second',
      translationKey: 'ui.button.3',
    })

    expect(first).toMatchObject({
      id: 'first',
      translationKey: 'ui.button.2',
      rect: { x: 12, y: 13, width: 20, height: 15 },
      rotation: 15,
      styleId: 'style',
    })
    expect(second?.rect).toEqual({ x: 22, y: 23, width: 20, height: 15 })
    expect(first?.render?.fill?.gradientStops?.[0]?.color).toBe('#ffffff')
    expect(first?.render).not.toBe(source.render)
  })

  it('keeps cross-sprite positions unshifted and constrains them to the target bounds', () => {
    const clipboard = new TextRegionClipboard()
    clipboard.copy({ spriteTableId: 'ui', spriteId: 'button' }, region())

    const pasted = clipboard.paste({
      spriteTableId: 'menu',
      spriteId: 'small-button',
      bounds: { width: 8, height: 6 },
      id: 'pasted',
      translationKey: 'menu.small-button.1',
    })

    expect(pasted).toMatchObject({
      id: 'pasted',
      translationKey: 'menu.small-button.1',
      rect: { x: 0, y: 0, width: 8, height: 6 },
    })
  })

  it('wraps same-sprite offsets instead of stacking later pastes at an edge', () => {
    const clipboard = new TextRegionClipboard()
    const source = region()
    source.rect = { x: 75, y: 0, width: 20, height: 15 }
    clipboard.copy({ spriteTableId: 'ui', spriteId: 'button' }, source)

    const first = clipboard.paste({
      spriteTableId: 'ui',
      spriteId: 'button',
      bounds: { width: 100, height: 100 },
      id: 'first',
      translationKey: 'ui.button.2',
    })
    const second = clipboard.paste({
      spriteTableId: 'ui',
      spriteId: 'button',
      bounds: { width: 100, height: 100 },
      id: 'second',
      translationKey: 'ui.button.3',
    })

    expect(first?.rect.x).toBe(4)
    expect(second?.rect.x).toBe(14)
  })
})
