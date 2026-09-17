import { useState } from 'react'

import { Dialog } from './Dialog'

interface SplitDialogProps {
  pageCount: number
  onClose: () => void
  onConfirm: (chunkSize: number) => void
}

export function SplitDialog({ pageCount, onClose, onConfirm }: SplitDialogProps) {
  const [value, setValue] = useState('1')
  const chunkSize = Number.parseInt(value, 10)
  const isValid = Number.isInteger(chunkSize) && chunkSize >= 1 && chunkSize <= pageCount
  const fileCount = isValid ? Math.ceil(pageCount / chunkSize) : 0

  return (
    <Dialog title="Split into files" onClose={onClose}>
      <label className="dialog__field">
        Pages per file
        <input
          className="dialog__input"
          type="number"
          min={1}
          max={pageCount}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <p className="dialog__hint">
        {isValid
          ? `Splits ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} into ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.`
          : `Enter a number between 1 and ${pageCount}.`}
        {' '}Your browser may ask permission for multiple downloads.
      </p>
      <div className="dialog__actions">
        <button type="button" className="button button--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="button"
          disabled={!isValid}
          onClick={() => onConfirm(chunkSize)}
        >
          Split
        </button>
      </div>
    </Dialog>
  )
}
