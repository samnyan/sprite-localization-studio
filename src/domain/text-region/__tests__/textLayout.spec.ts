import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import { layoutText, splitTextGraphemes } from '@/domain/text-region/textLayout'

const measure = (text: string, fontSize: number) => Array.from(text).length * fontSize

describe('layoutText', () => {
  it('wraps, limits lines, and ellipsizes from the persisted layout contract', () => {
    const result = layoutText('abcdef', 20, 100, {
      ...DEFAULT_TEXT_RENDER,
      fontSize: 10,
      wrap: true,
      maxLines: 2,
      overflow: 'ellipsis',
    }, measure)

    expect(result.lines).toEqual(['ab', 'c…'])
    expect(result.overflowed).toBe(true)
  })

  it('selects the largest fitting AutoFit size', () => {
    const result = layoutText('abcd', 40, 24, {
      ...DEFAULT_TEXT_RENDER,
      wrap: false,
      autoFit: { minFontSize: 8, maxFontSize: 24 },
    }, measure)

    expect(result.fontSize).toBe(10)
    expect(result.overflowed).toBe(false)
  })

  it('ellipsizes a single overflowing line and height-limited content', () => {
    const singleLine = layoutText('abcdef', 20, 100, {
      ...DEFAULT_TEXT_RENDER,
      fontSize: 10,
      overflow: 'ellipsis',
    }, measure)
    const heightLimited = layoutText('a\nb\nc', 100, 24, {
      ...DEFAULT_TEXT_RENDER,
      fontSize: 10,
      overflow: 'ellipsis',
    }, measure)

    expect(singleLine.lines).toEqual(['a…'])
    expect(singleLine.overflowed).toBe(true)
    expect(heightLimited.lines).toEqual(['a', 'b…'])
    expect(heightLimited.overflowed).toBe(true)
  })

  it('keeps grapheme clusters intact when wrapping and ellipsizing', () => {
    const measureGraphemes = (text: string, fontSize: number) =>
      splitTextGraphemes(text).length * fontSize
    const result = layoutText('ábc', 20, 100, {
      ...DEFAULT_TEXT_RENDER,
      fontSize: 10,
      wrap: true,
      maxLines: 1,
      overflow: 'ellipsis',
    }, measureGraphemes)

    expect(splitTextGraphemes('👨‍👩‍👧‍👦')).toEqual(['👨‍👩‍👧‍👦'])
    expect(result.lines).toEqual(['á…'])
  })

  it('keeps a whole line intact when Intl.Segmenter is unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined })
    vi.resetModules()
    try {
      const { splitTextGraphemes: splitWithoutSegmenter } = await import(
        '@/domain/text-region/textLayout'
      )
      expect(splitWithoutSegmenter('á👨‍👩‍👧‍👦🇨🇳')).toEqual(['á👨‍👩‍👧‍👦🇨🇳'])
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'Segmenter', descriptor)
      vi.resetModules()
    }
  })
})
