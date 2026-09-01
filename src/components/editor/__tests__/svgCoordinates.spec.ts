import { describe, expect, it, vi } from 'vitest'

import { getSvgPointerPosition } from '@/components/editor/svgCoordinates'

describe('getSvgPointerPosition', () => {
  it('returns (0,0) when SVG element is not provided', () => {
    expect(getSvgPointerPosition(null, 100, 100)).toEqual({ x: 0, y: 0 })
    expect(getSvgPointerPosition(undefined, 100, 100)).toEqual({ x: 0, y: 0 })
  })

  it('uses getScreenCTM when available for exact matrix transformation', () => {
    const mockPoint = {
      x: 0,
      y: 0,
      matrixTransform: vi.fn<(matrix: DOMMatrix) => DOMPoint>((matrix: DOMMatrix) => ({
        x: matrix.a * mockPoint.x + matrix.c * mockPoint.y + matrix.e,
        y: matrix.b * mockPoint.x + matrix.d * mockPoint.y + matrix.f,
        z: 0,
        w: 1,
        toJSON: () => ({}),
      } as DOMPoint)),
    } as unknown as SVGPoint

    const mockInverse = { a: 0.5, b: 0, c: 0, d: 0.25, e: -5, f: -10 } as unknown as DOMMatrix
    const mockCTM = {
      inverse: vi.fn<() => DOMMatrix>(() => mockInverse),
    } as unknown as DOMMatrix

    const svg = {
      getScreenCTM: vi.fn<() => DOMMatrix | null>(() => mockCTM),
      createSVGPoint: vi.fn<() => SVGPoint>(() => mockPoint),
    } as unknown as SVGSVGElement

    const result = getSvgPointerPosition(svg, 50, 60)

    expect(svg.getScreenCTM).toHaveBeenCalled()
    expect(mockCTM.inverse).toHaveBeenCalled()
    expect(svg.createSVGPoint).toHaveBeenCalled()
    expect(result).toEqual({ x: 20, y: 5 })
  })

  it('falls back to getBoundingClientRect when getScreenCTM throws', () => {
    const svg = {
      getScreenCTM: vi.fn<() => DOMMatrix | null>(() => {
        throw new Error('Matrix not invertible')
      }),
      getBoundingClientRect: vi.fn<() => DOMRect>(() => ({
        left: 100,
        top: 50,
        width: 200,
        height: 100,
        right: 300,
        bottom: 150,
        x: 100,
        y: 50,
        toJSON: () => '',
      })),
    } as unknown as SVGSVGElement

    const result = getSvgPointerPosition(svg, 200, 100, { width: 400, height: 200 })

    expect(result).toEqual({ x: 200, y: 100 })
  })

  it('falls back to getBoundingClientRect when getScreenCTM returns null', () => {
    const svg = {
      getScreenCTM: vi.fn<() => DOMMatrix | null>(() => null),
      getBoundingClientRect: vi.fn<() => DOMRect>(() => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => '',
      })),
      viewBox: {
        baseVal: {
          width: 50,
          height: 50,
        },
      },
    } as unknown as SVGSVGElement

    const result = getSvgPointerPosition(svg, 50, 50)

    expect(result).toEqual({ x: 25, y: 25 })
  })

  it('handles zero or negative boundingClientRect dimensions safely', () => {
    const svg = {
      getScreenCTM: vi.fn<() => DOMMatrix | null>(() => null),
      getBoundingClientRect: vi.fn<() => DOMRect>(() => ({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => '',
      })),
    } as unknown as SVGSVGElement

    expect(getSvgPointerPosition(svg, 50, 50)).toEqual({ x: 0, y: 0 })
  })
})
