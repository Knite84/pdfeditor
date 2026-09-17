import { useEffect, useState } from 'react'

import './App.css'
import { AddPdfDialog } from './components/AddPdfDialog'
import { DropZone } from './components/DropZone'
import { PageDetailDialog } from './components/PageDetailDialog'
import { PageGrid } from './components/PageGrid'
import { SignatureDialog } from './components/SignatureDialog'
import { SplitDialog } from './components/SplitDialog'
import { Toolbar } from './components/Toolbar'
import { useFileDrop } from './hooks/useFileDrop'
import { useDocumentStore } from './state/documentStore'
import type { InsertPosition } from './state/documentStore'

export default function App() {
  const pages = useDocumentStore((state) => state.pages)
  const isLoading = useDocumentStore((state) => state.isLoading)
  const isExporting = useDocumentStore((state) => state.isExporting)
  const error = useDocumentStore((state) => state.error)
  const addFiles = useDocumentStore((state) => state.addFiles)
  const clear = useDocumentStore((state) => state.clear)
  const dismissError = useDocumentStore((state) => state.dismissError)
  const exportDocument = useDocumentStore((state) => state.exportDocument)
  const splitDocument = useDocumentStore((state) => state.splitDocument)
  const imagePageSize = useDocumentStore((state) => state.imagePageSize)
  const setImagePageSize = useDocumentStore((state) => state.setImagePageSize)
  const signatures = useDocumentStore((state) => state.signatures)
  const placingSignatureId = useDocumentStore((state) => state.placingSignatureId)
  const setPlacingSignatureId = useDocumentStore((state) => state.setPlacingSignatureId)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false)
  const [detailPageId, setDetailPageId] = useState<string | null>(null)
  const { isDragging, handlers } = useFileDrop((files) => void addFiles(files))

  const hasPages = pages.length > 0
  const pageLabel = `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`
  const placingSignature =
    signatures.find((signature) => signature.id === placingSignatureId) ?? null
  let status: string | null = null
  if (isExporting) {
    status = 'Exporting…'
  } else if (isLoading) {
    status = 'Working…'
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key === 'Escape') {
        useDocumentStore.getState().setPlacingSignatureId(null)
        return
      }
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.signature-overlay'))
      ) {
        return
      }
      const state = useDocumentStore.getState()
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        state.selectedIds.length > 0
      ) {
        event.preventDefault()
        state.removeSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleAddConfirm = (files: File[], position: InsertPosition) => {
    setAddDialogOpen(false)
    void addFiles(files, { position })
  }

  const handleSplitConfirm = (chunkSize: number) => {
    setSplitDialogOpen(false)
    void splitDocument(chunkSize)
  }

  return (
    <div className="app" {...handlers}>
      <header className="app__header">
        <div className="app__brand">
          <span className="app__mark" aria-hidden="true" />
          <span className="app__title">PDF Editor</span>
        </div>
        <div className="app__actions">
          {hasPages ? <span className="app__count">{pageLabel}</span> : null}
          {status ? <span className="app__status">{status}</span> : null}
          {hasPages ? (
            <>
              <button
                type="button"
                className="button"
                disabled={isExporting || isLoading}
                onClick={() => void exportDocument()}
                title="Save the current page order as a new PDF"
              >
                Export PDF
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setSignatureDialogOpen(true)}
                title="Draw or upload signatures, then place them on pages"
              >
                Signatures
              </button>
              <label className="app__select-label" title="Page size used for image pages">
                Image page
                <select
                  className="select"
                  aria-label="Image page size"
                  value={imagePageSize}
                  onChange={(event) =>
                    setImagePageSize(event.target.value === 'letter' ? 'letter' : 'a4')
                  }
                >
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                </select>
              </label>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setAddDialogOpen(true)}
              >
                Add files
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => void clear()}
              >
                Clear
              </button>
            </>
          ) : null}
          <span className="app__badge">Local only</span>
        </div>
      </header>

      <main className="app__main">
        {error ? (
          <div className="alert" role="alert">
            <span className="alert__message">{error}</span>
            <button type="button" className="button button--ghost" onClick={dismissError}>
              Dismiss
            </button>
          </div>
        ) : null}

        {hasPages ? (
          <>
            <Toolbar onSplit={() => setSplitDialogOpen(true)} />
            {placingSignature ? (
              <div className="place-banner" role="status">
                <span>
                  Click a page to place “{placingSignature.name}”. Drag to move it afterwards.
                </span>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setPlacingSignatureId(null)}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <PageGrid onZoom={setDetailPageId} />
            <p className="app__hint">
              Click to select, Shift-click for a range, Ctrl/Cmd-click to toggle. Drag to
              reorder, Delete to remove, double-click to zoom. Drop more PDFs or images
              anywhere to append their pages.
            </p>
          </>
        ) : (
          <DropZone onFiles={(files) => void addFiles(files)} isDragging={isDragging} />
        )}
      </main>

      {isDragging && hasPages ? (
        <div className="app__drag-overlay" aria-hidden="true">
          Drop to add pages
        </div>
      ) : null}

      {addDialogOpen ? (
        <AddPdfDialog onClose={() => setAddDialogOpen(false)} onConfirm={handleAddConfirm} />
      ) : null}
      {splitDialogOpen ? (
        <SplitDialog
          pageCount={pages.length}
          onClose={() => setSplitDialogOpen(false)}
          onConfirm={handleSplitConfirm}
        />
      ) : null}
      {signatureDialogOpen ? (
        <SignatureDialog onClose={() => setSignatureDialogOpen(false)} />
      ) : null}
      {detailPageId ? (
        <PageDetailDialog
          pageId={detailPageId}
          onClose={() => setDetailPageId(null)}
          onNavigate={setDetailPageId}
        />
      ) : null}
    </div>
  )
}
