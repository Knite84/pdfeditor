import { useCallback, useRef, useState } from 'react'
import type { DragEvent } from 'react'

export interface FileDropHandlers {
  onDragEnter: (event: DragEvent) => void
  onDragOver: (event: DragEvent) => void
  onDragLeave: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
}

export function useFileDrop(onFiles: (files: File[]) => void): {
  isDragging: boolean
  handlers: FileDropHandlers
} {
  const [isDragging, setIsDragging] = useState(false)
  const depth = useRef(0)

  const onDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault()
    depth.current += 1
    setIsDragging(true)
  }, [])

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const onDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault()
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      depth.current = 0
      setIsDragging(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length > 0) {
        onFiles(files)
      }
    },
    [onFiles],
  )

  return { isDragging, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } }
}
