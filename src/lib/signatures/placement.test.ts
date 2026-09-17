import { describe, expect, it } from 'vitest'

import { computePlacementRect } from './placement'

const FRAME = { left: 10, top: 20, width: 200, height: 100 }

describe('computePlacementRect', () => {
  it('centers an aspect-preserved rect on the drop point', () => {
    const rect = computePlacementRect(100, 50, FRAME, { x: 110, y: 70 })
    expect(rect).not.toBeNull()
    expect(rect?.width).toBeCloseTo(0.32, 5)
    expect(rect?.height).toBeCloseTo(0.32, 5)
    expect(rect?.x).toBeCloseTo(0.34, 5)
    expect(rect?.y).toBeCloseTo(0.34, 5)
  })

  it('clamps rects to the page bounds', () => {
    const rect = computePlacementRect(100, 50, FRAME, { x: 10, y: 20 })
    expect(rect?.x).toBe(0)
    expect(rect?.y).toBe(0)
  })

  it('rejects unusable inputs', () => {
    expect(computePlacementRect(0, 50, FRAME, { x: 110, y: 70 })).toBeNull()
    expect(
      computePlacementRect(100, 50, { ...FRAME, width: 0 }, { x: 110, y: 70 }),
    ).toBeNull()
  })
})
