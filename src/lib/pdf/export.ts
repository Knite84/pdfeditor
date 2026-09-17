import { PDFDocument, degrees } from 'pdf-lib'

import { createId } from '../id'
import type { PageRef, Source } from '../../types'

const sourceDocumentCache = new Map<string, Promise<PDFDocument>>()

function getSourceDocument(source: Source): Promise<PDFDocument> {
  let pending = sourceDocumentCache.get(source.id)
  if (!pending) {
    // pdf-lib may detach the input buffer, so parse a private copy.
    pending = PDFDocument.load(source.bytes.slice(0))
    sourceDocumentCache.set(source.id, pending)
  }
  return pending
}

export function clearExportCache(): void {
  sourceDocumentCache.clear()
}

export async function buildPdf(
  pages: PageRef[],
  sources: Record<string, Source>,
): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error('There are no pages to export.')
  }

  const output = await PDFDocument.create()
  for (const page of pages) {
    const source = sources[page.sourceId]
    if (!source) {
      throw new Error('A page refers to a source that is no longer loaded.')
    }
    if (source.kind !== 'pdf') {
      throw new Error(`"${source.name}" is not a PDF and cannot be exported yet.`)
    }

    const sourceDocument = await getSourceDocument(source)
    const [copied] = await output.copyPages(sourceDocument, [page.sourcePageIndex])
    const total = (((copied.getRotation().angle + page.rotation) % 360) + 360) % 360
    copied.setRotation(degrees(total))
    output.addPage(copied)
  }

  return output.save()
}

export function suggestBaseName(
  pages: PageRef[],
  sources: Record<string, Source>,
): string {
  const firstSource = pages.length > 0 ? sources[pages[0].sourceId] : undefined
  return (firstSource?.name ?? 'document').replace(/\.pdf$/i, '') || 'document'
}

export function suggestFileName(
  pages: PageRef[],
  sources: Record<string, Source>,
  label?: string,
): string {
  const base = suggestBaseName(pages, sources)
  if (label) {
    return `${base}-${label}.pdf`
  }
  const sourceCount = new Set(pages.map((page) => page.sourceId)).size
  return sourceCount > 1 ? `${base}-merged.pdf` : `${base}-edited.pdf`
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename || `document-${createId().slice(0, 8)}.pdf`
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
