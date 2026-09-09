import { describe, expect, it } from 'vitest'

import { resolveTextContentArea } from '@/domain/text-region/textPadding'

describe('resolveTextContentArea', () => {
  it('reduces the content box and offsets its center by asymmetric padding', () => {
    expect(resolveTextContentArea(100, 50, { top: 4, right: 10, bottom: 6, left: 20 })).toEqual({
      width: 70,
      height: 40,
      offsetX: 5,
      offsetY: -1,
    })
  })

  it('treats missing padding as zero', () => {
    expect(resolveTextContentArea(100, 50)).toEqual({
      width: 100,
      height: 50,
      offsetX: 0,
      offsetY: 0,
    })
  })
})
