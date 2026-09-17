import { useEffect, useRef, useState } from 'react'

import { getPageThumbnail } from '../lib/pdf/pdfjs'
import { computePlacementRect } from '../lib/signatures/placement'
import { useDocumentStore } from '../state/documentStore'
import type { Source } from '../types'
import { PlacementOverlay } from './PlacementOverlay'

const MAX_DPR = 2

interface PageSurfaceProps {
  pageId: string
  source: Source
  pageIndex: number
  rotation: number
  alt: string
  thumbWidth: number
}

export function PageSurface({
  pageId,
  source,
  pageIndex,
  rotation,
  alt,
  thumbWidth,
}: PageSurfaceProps) {
  const placements = useDocumentStore((state) => state.placements)
  const signatures = useDocumentStore((state) => state.signatures)
  const placingSignatureId = useDocumentStore((state) => state.placingSignatureId)
  const placeSignature = useDocumentStore((state) => state.placeSignature)

  const frameRef = useRef<HTMLDivElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    getPageThumbnail(source, pageIndex, thumbWidth, dpr, rotation)
      .then((nextUrl) => {
        if (active) {
          setUrl(nextUrl)
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true)
        }
      })

    return () => {
      active = false
    }
  }, [source, pageIndex, rotation, thumbWidth])

  const assetMap = new Map(signatures.map((signature) => [signature.id, signature]))
  const pagePlacements = placements.filter((placement) => placement.pageId === pageId)

  const handlePlaceAt = (clientX: number, clientY: number) => {
    if (!placingSignatureId) {
      return
    }
    const asset = assetMap.get(placingSignatureId)
    const frame = frameRef.current
    if (!asset || !frame) {
      return
    }
    const rect = frame.getBoundingClientRect()
    const placement = computePlacementRect(
      asset.width,
      asset.height,
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      { x: clientX, y: clientY },
    )
    if (placement) {
      placeSignature(pageId, placingSignatureId, placement)
    }
  }

  return (
    <div
      ref={frameRef}
      className="page-thumb__canvas"
      onClick={
        placingSignatureId
          ? (event) => {
              event.stopPropagation()
              handlePlaceAt(event.clientX, event.clientY)
            }
          : undefined
      }
    >
      {failed ? (
        <span className="page-thumb__status">Preview unavailable</span>
      ) : url ? (
        <img className="page-thumb__image" src={url} alt={alt} draggable={false} />
      ) : (
        <span className="page-thumb__spinner" role="status" aria-label="Rendering page" />
      )}
      {url
        ? pagePlacements.map((placement) => {
            const asset = assetMap.get(placement.signatureId)
            return asset ? (
              <PlacementOverlay
                key={placement.id}
                placement={placement}
                asset={asset}
                frameRef={frameRef}
              />
            ) : null
          })
        : null}
    </div>
  )
}
