import type { PlacementRect } from '../../state/documentStore'

const DEFAULT_WIDTH_FRACTION = 0.32

export interface PlacementFrame {
  left: number
  top: number
  width: number
  height: number
}

export interface PlacementPoint {
  x: number
  y: number
}

/**
 * Computes a placement rect (fractions of the displayed page, top-left
 * origin) for a signature dropped at a client point, preserving the
 * signature's aspect ratio. Returns null when the inputs are unusable.
 */
export function computePlacementRect(
  assetWidth: number,
  assetHeight: number,
  frame: PlacementFrame,
  point: PlacementPoint,
  widthFraction = DEFAULT_WIDTH_FRACTION,
): PlacementRect | null {
  if (assetWidth <= 0 || assetHeight <= 0 || frame.width <= 0 || frame.height <= 0) {
    return null
  }
  const signatureAspect = assetWidth / assetHeight
  const width = widthFraction
  const height = (width * (frame.width / frame.height)) / signatureAspect
  const x = Math.min(Math.max((point.x - frame.left) / frame.width - width / 2, 0), 1 - width)
  const y = Math.min(
    Math.max((point.y - frame.top) / frame.height - height / 2, 0),
    Math.max(0, 1 - height),
  )
  return { x, y, width, height }
}
