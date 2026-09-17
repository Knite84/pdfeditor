import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'

import { getPageThumbnail } from '../lib/pdf/pdfjs'
import type { Source } from '../types'

const THUMB_WIDTH = 200
const MAX_DPR = 2

export type SelectEvent = ReactMouseEvent<HTMLLIElement> | ReactKeyboardEvent<HTMLLIElement>

interface PageThumbProps {
  id: string
  source: Source
  pageIndex: number
  pageNumber: number
  rotation: number
  selected: boolean
  onSelect: (id: string, event: SelectEvent) => void
}

export function PageThumb({
  id,
  source,
  pageIndex,
  pageNumber,
  rotation,
  selected,
  onSelect,
}: PageThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    getPageThumbnail(source, pageIndex, THUMB_WIDTH, dpr, rotation)
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
  }, [source, pageIndex, rotation])

  const className = `page-thumb${selected ? ' page-thumb--selected' : ''}${
    isDragging ? ' page-thumb--dragging' : ''
  }`

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
          onSelect(id, event)
        }
      }}
    >
      <div className="page-thumb__frame">
        {failed ? (
          <span className="page-thumb__status">Preview unavailable</span>
        ) : url ? (
          <img className="page-thumb__image" src={url} alt={`Page ${pageNumber}`} />
        ) : (
          <span className="page-thumb__spinner" role="status" aria-label="Rendering page" />
        )}
      </div>
      <span className="page-thumb__number">{pageNumber}</span>
    </li>
  )
}
