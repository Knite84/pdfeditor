import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'

import { useDocumentStore } from '../state/documentStore'
import type { SelectMode } from '../state/documentStore'
import { PageThumb } from './PageThumb'
import type { SelectEvent } from './PageThumb'

interface PageGridProps {
  onZoom: (id: string) => void
}

export function PageGrid({ onZoom }: PageGridProps) {
  const pages = useDocumentStore((state) => state.pages)
  const sources = useDocumentStore((state) => state.sources)
  const selectedIds = useDocumentStore((state) => state.selectedIds)
  const selectPage = useDocumentStore((state) => state.selectPage)
  const clearSelection = useDocumentStore((state) => state.clearSelection)
  const reorderPages = useDocumentStore((state) => state.reorderPages)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderPages(String(active.id), String(over.id))
    }
  }

  const handleSelect = (id: string, event: SelectEvent) => {
    let mode: SelectMode = 'replace'
    if (event.shiftKey) {
      mode = 'range'
    } else if (event.metaKey || event.ctrlKey) {
      mode = 'toggle'
    }
    selectPage(id, mode)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
        <ul
          className="page-grid"
          role="listbox"
          aria-label="Document pages"
          aria-multiselectable="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              clearSelection()
            }
          }}
        >
          {pages.map((page, index) => {
            const source = sources[page.sourceId]
            if (!source) {
              return null
            }
            return (
              <PageThumb
                key={page.id}
                id={page.id}
                source={source}
                pageIndex={page.sourcePageIndex}
                pageNumber={index + 1}
                rotation={page.rotation}
                selected={selectedIds.includes(page.id)}
                onSelect={handleSelect}
                onZoom={onZoom}
              />
            )
          })}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
