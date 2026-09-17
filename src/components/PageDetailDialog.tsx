import { useDocumentStore } from '../state/documentStore'
import { Dialog } from './Dialog'
import { PageSurface } from './PageSurface'

const DETAIL_WIDTH = 760

interface PageDetailDialogProps {
  pageId: string
  onClose: () => void
  onNavigate: (pageId: string) => void
}

export function PageDetailDialog({ pageId, onClose, onNavigate }: PageDetailDialogProps) {
  const pages = useDocumentStore((state) => state.pages)
  const sources = useDocumentStore((state) => state.sources)

  const index = pages.findIndex((page) => page.id === pageId)
  const page = index === -1 ? undefined : pages[index]
  const source = page ? sources[page.sourceId] : undefined

  const previousId = index > 0 ? pages[index - 1]?.id : undefined
  const nextId = index !== -1 && index < pages.length - 1 ? pages[index + 1]?.id : undefined

  const title =
    page && index !== -1 ? `Page ${index + 1} of ${pages.length}` : 'Page preview'

  return (
    <Dialog title={title} onClose={onClose} wide>
      <div className="page-detail__nav">
        <button
          type="button"
          className="button button--ghost"
          disabled={!previousId}
          onClick={() => {
            if (previousId) {
              onNavigate(previousId)
            }
          }}
        >
          ← Previous
        </button>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="button button--ghost"
          disabled={!nextId}
          onClick={() => {
            if (nextId) {
              onNavigate(nextId)
            }
          }}
        >
          Next →
        </button>
      </div>
      <div className="page-detail__canvas">
        {page && source ? (
          <PageSurface
            key={page.id}
            pageId={page.id}
            source={source}
            pageIndex={page.sourcePageIndex}
            rotation={page.rotation}
            alt={title}
            thumbWidth={DETAIL_WIDTH}
          />
        ) : (
          <p className="dialog__hint">This page is no longer available.</p>
        )}
      </div>
      <p className="dialog__hint">
        Click to place the selected signature precisely. Drag to move, use the corner
        handle to resize.
      </p>
    </Dialog>
  )
}
