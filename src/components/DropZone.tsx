import { useRef } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  isDragging: boolean
}

export function DropZone({ onFiles, isDragging }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => inputRef.current?.click()

  return (
    <section
      className={`dropzone${isDragging ? ' dropzone--active' : ''}`}
      aria-label="Document drop area"
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPicker()
        }
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) {
            onFiles(files)
          }
          event.target.value = ''
        }}
      />
      <span className="dropzone__icon" aria-hidden="true" />
      <p className="dropzone__title">Drop PDFs here, or click to browse</p>
      <p className="dropzone__hint">
        Everything is processed in your browser. Nothing is uploaded.
      </p>
    </section>
  )
}
