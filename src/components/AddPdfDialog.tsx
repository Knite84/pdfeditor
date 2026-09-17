import { useRef, useState } from 'react'

import { useDocumentStore } from '../state/documentStore'
import type { InsertPosition } from '../state/documentStore'
import { Dialog } from './Dialog'

interface AddPdfDialogProps {
  onClose: () => void
  onConfirm: (files: File[], position: InsertPosition) => void
}

export function AddPdfDialog({ onClose, onConfirm }: AddPdfDialogProps) {
  const selectionCount = useDocumentStore((state) => state.selectedIds.length)
  const [files, setFiles] = useState<File[]>([])
  const [position, setPosition] = useState<'end' | 'start' | 'after-selection'>('end')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (list: FileList | null) => {
    setFiles(list ? Array.from(list) : [])
  }

  const canConfirm = files.length > 0

  return (
    <Dialog title="Add PDF" onClose={onClose}>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => inputRef.current?.click()}
      >
        {files.length > 0
          ? `${files.length} ${files.length === 1 ? 'file' : 'files'} chosen`
          : 'Choose PDF files'}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <fieldset className="dialog__group">
        <legend className="dialog__legend">Insert pages</legend>
        <label className="dialog__option">
          <input
            type="radio"
            name="insert-position"
            checked={position === 'end'}
            onChange={() => setPosition('end')}
          />
          Append to end
        </label>
        <label className="dialog__option">
          <input
            type="radio"
            name="insert-position"
            checked={position === 'start'}
            onChange={() => setPosition('start')}
          />
          Insert at start
        </label>
        <label className="dialog__option">
          <input
            type="radio"
            name="insert-position"
            checked={position === 'after-selection'}
            disabled={selectionCount === 0}
            onChange={() => setPosition('after-selection')}
          />
          Insert after selection
          {selectionCount === 0 ? ' (nothing selected)' : ` (${selectionCount} selected)`}
        </label>
      </fieldset>

      <div className="dialog__actions">
        <button type="button" className="button button--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="button"
          disabled={!canConfirm}
          onClick={() => onConfirm(files, position)}
        >
          Add pages
        </button>
      </div>
    </Dialog>
  )
}
