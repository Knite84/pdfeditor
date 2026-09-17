import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'

import { computePlacementRect } from '../lib/signatures/placement'
import { useDocumentStore } from '../state/documentStore'
import type { Source } from '../types'
import { PageSurface } from './PageSurface'

export type SelectEvent = ReactMouseEvent<HTMLLIElement> | ReactKeyboardEvent<HTMLLIElement>

interface PageThumbProps {
  id: string
  source: Source
  pageIndex: number
  pageNumber: number
  rotation: number
  selected: boolean
  onSelect: (id: string, event: SelectEvent) => void
  onZoom: (id: string) => void
}

export function PageThumb({
  id,
  source,
  pageIndex,
  pageNumber,
  rotation,
  selected,
  onSelect,
  onZoom,
}: PageThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const placingSignatureId = useDocumentStore((state) => state.placingSignatureId)
  const signatures = useDocumentStore((state) => state.signatures)
  const placeSignature = useDocumentStore((state) => state.placeSignature)

  const handlePlaceCenter = (container: HTMLLIElement) => {
    if (!placingSignatureId) {
      return
    }
    const asset = signatures.find((signature) => signature.id === placingSignatureId)
    const canvas = container.querySelector('.page-thumb__canvas')
    if (!asset || !canvas) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const placement = computePlacementRect(
      asset.width,
      asset.height,
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    )
    if (placement) {
      placeSignature(id, placingSignatureId, placement)
    }
  }

  const className = `page-thumb${selected ? ' page-thumb--selected' : ''}${
    isDragging ? ' page-thumb--dragging' : ''
  }${placingSignatureId ? ' page-thumb--placing' : ''}`

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={className}
      {...attributes}
      {...listeners}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={(event) => onSelect(id, event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (placingSignatureId) {
            handlePlaceCenter(event.currentTarget)
          } else {
            onSelect(id, event)
          }
        }
      }}
      onDoubleClick={() => {
        if (!placingSignatureId) {
          onZoom(id)
        }
      }}
    >
      <div className="page-thumb__frame">
        <PageSurface
          pageId={id}
          source={source}
          pageIndex={pageIndex}
          rotation={rotation}
          alt={`Page ${pageNumber}`}
          thumbWidth={200}
        />
      </div>
      <span className="page-thumb__number">{pageNumber}</span>
    </li>
  )
}
