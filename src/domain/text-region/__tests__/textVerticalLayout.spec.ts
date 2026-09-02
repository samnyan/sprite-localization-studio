import { describe, expect, it } from 'vitest'

import { alignTextBlockBounds, layoutTextBaselines } from '@/domain/text-region/textVerticalLayout'

describe('text vertical layout', () => {
  it('centers actual ink bounds instead of nominal line boxes', () => {
    expect(layoutTextBaselines([{ ascent: 18, descent: 6 }], 30, 80, 'middle')).toEqual([6])
  })

  it('aligns ink bounds to the requested edge', () => {
    expect(alignTextBlockBounds(-18, 36, 100, 'top')).toBe(-32)
    expect(alignTextBlockBounds(-18, 36, 100, 'bottom')).toBe(14)
  })
})
