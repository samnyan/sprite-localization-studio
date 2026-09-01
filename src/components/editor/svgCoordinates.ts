import type { Point, Size } from '@/domain/shared/geometry'

/**
 * Maps a pointer client event coordinate to local SVG/Sprite coordinates.
 * Prefers SVGMatrix (getScreenCTM) for exact mapping under zoom, CSS transforms,
 * and different device pixel ratios, with a safe bounding-box fallback.
 */
export function getSvgPointerPosition(
  svg: SVGSVGElement | null | undefined,
  clientX: number,
  clientY: number,
  fallbackBounds?: Size,
): Point {
  if (!svg) return { x: 0, y: 0 }

  try {
    const ctm = svg.getScreenCTM?.()
    if (ctm) {
      const inverse = ctm.inverse()
      if (typeof svg.createSVGPoint === 'function') {
        const point = svg.createSVGPoint()
        point.x = clientX
        point.y = clientY
        const transformed = point.matrixTransform(inverse)
        if (Number.isFinite(transformed.x) && Number.isFinite(transformed.y)) {
          return { x: transformed.x, y: transformed.y }
        }
      } else if (typeof DOMPoint === 'function') {
        const point = new DOMPoint(clientX, clientY)
        const transformed = point.matrixTransform(inverse)
        if (Number.isFinite(transformed.x) && Number.isFinite(transformed.y)) {
          return { x: transformed.x, y: transformed.y }
        }
      }
    }
  } catch {
    // Non-invertible matrix or browser error; fallback to bounding box calculation
  }

  const box = svg.getBoundingClientRect?.()
  if (!box || box.width <= 0 || box.height <= 0) return { x: 0, y: 0 }

  const targetWidth = fallbackBounds?.width ?? (svg.viewBox?.baseVal?.width || box.width)
  const targetHeight = fallbackBounds?.height ?? (svg.viewBox?.baseVal?.height || box.height)

  return {
    x: ((clientX - box.left) / box.width) * targetWidth,
    y: ((clientY - box.top) / box.height) * targetHeight,
  }
}
