import { describe, expect, it } from 'vitest'

import type { Sprite } from '@/domain/sprite/types'
import {
  getLogicalSpriteSize,
  getLogicalTrimmedSize,
  getStoredToLogicalTransform,
} from '@/infrastructure/image/spriteGeometry'

function sprite(rotation: Sprite['rotation']): Sprite {
  return {
    id: 'sprite',
    name: 'sprite',
    textureId: 'page-00',
    frame: { x: 0, y: 0, width: 80, height: 240 },
    rotation,
    trimmed: false,
  }
}

describe('sprite geometry', () => {
  it('swaps logical dimensions for quarter turns', () => {
    expect(getLogicalTrimmedSize(sprite(0))).toEqual({ width: 80, height: 240 })
    expect(getLogicalTrimmedSize(sprite(90))).toEqual({ width: 240, height: 80 })
    expect(getLogicalTrimmedSize(sprite(270))).toEqual({ width: 240, height: 80 })
  })

  it('uses the original size for trimmed sprites', () => {
    expect(
      getLogicalSpriteSize({
        ...sprite(90),
        trimmed: true,
        originalSize: { width: 280, height: 100 },
        trimOffset: { x: 20, y: 10 },
      }),
    ).toEqual({ width: 280, height: 100 })
  })

  it('returns inverse transforms for stored rotations', () => {
    expect(getStoredToLogicalTransform(sprite(0))).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    })
    expect(getStoredToLogicalTransform(sprite(90))).toEqual({
      a: 0,
      b: -1,
      c: 1,
      d: 0,
      e: 0,
      f: 80,
    })
    expect(getStoredToLogicalTransform(sprite(180))).toEqual({
      a: -1,
      b: 0,
      c: 0,
      d: -1,
      e: 80,
      f: 240,
    })
    expect(getStoredToLogicalTransform(sprite(270))).toEqual({
      a: 0,
      b: 1,
      c: -1,
      d: 0,
      e: 240,
      f: 0,
    })
  })
})
