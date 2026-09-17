import { useDocumentStore } from '../state/documentStore'

interface ToolbarProps {
  onSplit: () => void
}

export function Toolbar({ onSplit }: ToolbarProps) {
  const pageCount = useDocumentStore((state) => state.pages.length)
  const selectedCount = useDocumentStore((state) => state.selectedIds.length)
  const isExporting = useDocumentStore((state) => state.isExporting)
  const rotateSelected = useDocumentStore((state) => state.rotateSelected)
  const removeSelected = useDocumentStore((state) => state.removeSelected)
  const exportSelected = useDocumentStore((state) => state.exportSelected)
  const selectAll = useDocumentStore((state) => state.selectAll)
  const clearSelection = useDocumentStore((state) => state.clearSelection)

  const hasSelection = selectedCount > 0
  const info = hasSelection
    ? `${selectedCount} selected`
    : `${pageCount} ${pageCount === 1 ? 'page' : 'pages'} total`

  return (
    <div className="toolbar" role="toolbar" aria-label="Page actions">
      <span className="toolbar__info">{info}</span>
      <button
        type="button"
        className="button button--ghost"
        disabled={!hasSelection}
        onClick={() => rotateSelected(-90)}
        title="Rotate selected pages 90 degrees counter-clockwise"
      >
        Rotate left
      </button>
      <button
        type="button"
        className="button button--ghost"
        disabled={!hasSelection}
        onClick={() => rotateSelected(90)}
        title="Rotate selected pages 90 degrees clockwise"
      >
        Rotate right
      </button>
      <button
        type="button"
        className="button button--danger"
        disabled={!hasSelection}
        onClick={removeSelected}
        title="Remove selected pages"
      >
        Delete
      </button>
      <button
        type="button"
        className="button button--ghost"
        disabled={!hasSelection || isExporting}
        onClick={() => void exportSelected()}
        title="Save the selected pages as a new PDF"
      >
        Extract
      </button>
      <button
        type="button"
        className="button button--ghost"
        disabled={isExporting}
        onClick={onSplit}
        title="Split the document into multi-page files"
      >
        Split…
      </button>
      <span className="toolbar__spacer" aria-hidden="true" />
      <button
        type="button"
        className="button button--ghost"
        onClick={selectAll}
        title="Select all pages"
      >
        Select all
      </button>
      <button
        type="button"
        className="button button--ghost"
        disabled={!hasSelection}
        onClick={clearSelection}
        title="Clear the selection"
      >
        Deselect
      </button>
    </div>
  )
}
