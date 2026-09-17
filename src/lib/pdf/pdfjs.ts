import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { Source } from '../../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const documentCache = new Map<string, Promise<PDFDocumentProxy>>()
const thumbnailCache = new Map<string, Promise<string>>()
const sourceThumbnailKeys = new Map<string, Set<string>>()

function getDocument(source: Source): Promise<PDFDocumentProxy> {
  let pending = documentCache.get(source.id)
  if (!pending) {
    // pdf.js transfers the buffer to its worker, so hand it a private copy.
    const task = pdfjs.getDocument({
      data: source.bytes.slice(0),
      isEvalSupported: false,
      standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
      cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
      cMapPacked: true,
    })
    pending = task.promise
    documentCache.set(source.id, pending)
  }
  return pending
}

function trackKey(sourceId: string, key: string): void {
  let keys = sourceThumbnailKeys.get(sourceId)
  if (!keys) {
    keys = new Set()
    sourceThumbnailKeys.set(sourceId, keys)
  }
  keys.add(key)
}

async function renderThumbnail(
  source: Source,
  pageIndex: number,
  width: number,
  dpr: number,
  rotation: number,
): Promise<string> {
  const pdfDocument = await getDocument(source)
  const page = await pdfDocument.getPage(pageIndex + 1)
  const totalRotation = (((page.rotate + rotation) % 360) + 360) % 360
  const base = page.getViewport({ scale: 1, rotation: totalRotation })
  const viewport = page.getViewport({ scale: (width * dpr) / base.width, rotation: totalRotation })

  const canvas = window.document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))

  // `intent: 'print'` renders without relying on requestAnimationFrame, so
  // thumbnails still complete while the tab is in the background.
  const task = page.render({ canvas, viewport, intent: 'print' })
  await task.promise

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  if (!blob) {
    throw new Error('Failed to encode the rendered page.')
  }
  return URL.createObjectURL(blob)
}

export function getPageThumbnail(
  source: Source,
  pageIndex: number,
  width: number,
  dpr: number,
  rotation = 0,
): Promise<string> {
  const normalizedRotation = ((rotation % 360) + 360) % 360
  const key = `${source.id}:${pageIndex}:${Math.round(width * dpr)}:${normalizedRotation}`
  let pending = thumbnailCache.get(key)
  if (!pending) {
    pending = renderThumbnail(source, pageIndex, width, dpr, normalizedRotation)
    thumbnailCache.set(key, pending)
    trackKey(source.id, key)
  }
  return pending
}

export async function revokeSourceThumbnails(sourceId: string): Promise<void> {
  const keys = sourceThumbnailKeys.get(sourceId)
  if (keys) {
    for (const key of keys) {
      const pending = thumbnailCache.get(key)
      thumbnailCache.delete(key)
      if (pending) {
        pending.then((url) => URL.revokeObjectURL(url)).catch(() => undefined)
      }
    }
    sourceThumbnailKeys.delete(sourceId)
  }

  const document = documentCache.get(sourceId)
  documentCache.delete(sourceId)
  if (document) {
    document.then((proxy) => proxy.destroy()).catch(() => undefined)
  }
}

export async function revokeAllThumbnails(): Promise<void> {
  for (const [key, pending] of [...thumbnailCache]) {
    thumbnailCache.delete(key)
    pending.then((url) => URL.revokeObjectURL(url)).catch(() => undefined)
  }
  sourceThumbnailKeys.clear()

  for (const [sourceId, pending] of [...documentCache]) {
    documentCache.delete(sourceId)
    pending.then((proxy) => proxy.destroy()).catch(() => undefined)
  }
}
