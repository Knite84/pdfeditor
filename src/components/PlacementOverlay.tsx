import { useRef, useState } from 'react'
import type { RefObject } from 'react'

import { signatureObjectUrl } from '../lib/signatures/assets'
import { useDocumentStore } from '../state/documentStore'
import type { SignatureAsset, SignaturePlacement } from '../types'

interface PlacementOverlayProps {
  placement: SignaturePlacement
  asset: SignatureAsset
  frameRef: RefObject<HTMLDivElement | null>
}

interface Gesture {
  mode: 'move' | 'resize'
  startX: number
  startY: number
  originX: number
  originY: number
  originWidth: number
  frameWidth: number
  frameHeight: number
}

export function PlacementOverlay({ placement, asset, frameRef }: PlacementOverlayProps) {
  const movePlacement = useDocumentStore((state) => state.movePlacement)
  const resizePlacement = useDocumentStore((state) => state.resizePlacement)
  const removePlacement = useDocumentStore((state) => state.removePlacement)

  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [resizeWidth, setResizeWidth] = useState<number | null>(null)
  const gestureRef = useRef<Gesture | null>(null)

  const beginGesture = (
    event: React.PointerEvent,
    mode: 'move' | 'resize',
  ): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    const rect = frameRef.current?.getBoundingClientRect() ?? null
    if (!rect || rect.width === 0 || rect.height === 0) {
      return
    }
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originX: placement.x,
      originY: placement.y,
      originWidth: placement.width,
      frameWidth: rect.width,
      frameHeight: rect.height,
    }
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const gesture = gestureRef.current
    if (!gesture) {
      return
    }
    if (gesture.mode === 'move') {
      setDrag({
        x: gesture.originX + (event.clientX - gesture.startX) / gesture.frameWidth,
        y: gesture.originY + (event.clientY - gesture.startY) / gesture.frameHeight,
      })
    } else {
      setResizeWidth(
        gesture.originWidth + (event.clientX - gesture.startX) / gesture.frameWidth,
      )
    }
  }

  const handlePointerUp = () => {
    const gesture = gestureRef.current
    gestureRef.current = null
    if (!gesture) {
      return
    }
    if (gesture.mode === 'move') {
      setDrag((current) => {
        if (current) {
          movePlacement(placement.id, current.x, current.y)
        }
        return null
      })
    } else {
      setResizeWidth((current) => {
        if (current !== null) {
          const frameAspect =
            gesture.frameHeight === 0 ? 1 : gesture.frameWidth / gesture.frameHeight
          const signatureAspect = asset.height === 0 ? 1 : asset.width / asset.height
          resizePlacement(placement.id, current, (current * frameAspect) / signatureAspect)
        }
        return null
      })
    }
  }

  const renderedX = drag?.x ?? placement.x
  const renderedY = drag?.y ?? placement.y
  const renderedWidth = resizeWidth ?? placement.width

  return (
    <div
      className="signature-overlay"
      style={{
        left: `${renderedX * 100}%`,
        top: `${renderedY * 100}%`,
        width: `${renderedWidth * 100}%`,
        aspectRatio: `${asset.width} / ${asset.height}`,
      }}
      onPointerDown={(event) => beginGesture(event, 'move')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(event) => event.stopPropagation()}
    >
      <img
        className="signature-overlay__image"
        src={signatureObjectUrl(asset)}
        alt="Placed signature"
        draggable={false}
      />
      <button
        type="button"
        className="signature-overlay__delete"
        aria-label="Remove placed signature"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          removePlacement(placement.id)
        }}
      >
        ×
      </button>
      <span
        className="signature-overlay__handle"
        aria-hidden="true"
        onPointerDown={(event) => beginGesture(event, 'resize')}
      />
    </div>
  )
}
