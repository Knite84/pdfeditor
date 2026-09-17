import { PDFDocument, degrees } from 'pdf-lib'
import type { PDFImage, PDFPage } from 'pdf-lib'

import { createId } from '../id'
import type {
  ImagePageSize,
  PageRef,
  SignatureAsset,
  SignaturePlacement,
  Source,
} from '../../types'

export interface BuildPdfOptions {
  imagePageSize?: ImagePageSize
  placements?: SignaturePlacement[]
  signatures?: Record<string, SignatureAsset>
}

export interface SignaturePageRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Maps a placement rect (fractions of the displayed page, top-left origin)
 * into pdf-lib page coordinates (points, bottom-left origin), accounting for
 * the page's total clockwise rotation.
 */
export function mapSignatureRect(
  placement: Pick<SignaturePlacement, 'x' | 'y' | 'width' | 'height'>,
  pageWidth: number,
  pageHeight: number,
  totalRotation: number,
): SignaturePageRect {
  const normalized = (((totalRotation % 360) + 360) % 360)
  const displayedWidth = normalized === 90 || normalized === 270 ? pageHeight : pageWidth
  const displayedHeight = normalized === 90 || normalized === 270 ? pageWidth : pageHeight

  const xd = placement.x * displayedWidth
  const yd = placement.y * displayedHeight
  const wd = placement.width * displayedWidth
  const hd = placement.height * displayedHeight

  let x: number
  let y: number
  let width: number
  let height: number
  if (normalized === 90) {
    x = yd
    y = displayedWidth - xd - wd
    width = hd
    height = wd
  } else if (normalized === 180) {
    x = displayedWidth - xd - wd
    y = displayedHeight - yd - hd
    width = wd
    height = hd
  } else if (normalized === 270) {
    x = displayedHeight - yd - hd
    y = xd
    width = hd
    height = wd
  } else {
    x = xd
    y = yd
    width = wd
    height = hd
  }

  return { x, y: pageHeight - y - height, width, height }
}

async function stampPageSignatures(
  output: PDFDocument,
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  totalRotation: number,
  pageId: string,
  placements: SignaturePlacement[],
  signatures: Record<string, SignatureAsset>,
  embeddedCache: Map<string, PDFImage>,
): Promise<void> {
  for (const placement of placements) {
    if (placement.pageId !== pageId) {
      continue
    }
    const asset = signatures[placement.signatureId]
    if (!asset) {
      continue
    }
    let embedded = embeddedCache.get(asset.id)
    if (!embedded) {
      embedded = await output.embedPng(new Uint8Array(asset.pngBytes))
      embeddedCache.set(asset.id, embedded)
    }
    const rect = mapSignatureRect(placement, pageWidth, pageHeight, totalRotation)
    if (!(rect.width > 0 && rect.height > 0)) {
      continue
    }
    page.drawImage(embedded, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })
  }
}

const IMAGE_PAGE_SIZES: Record<ImagePageSize, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
}

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

async function rotateImageBytes(
  data: Uint8Array<ArrayBuffer>,
  mimeType: string,
  rotation: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const bitmap = await createImageBitmap(new Blob([data], { type: mimeType }))
  try {
    if (bitmap.width === 0 || bitmap.height === 0) {
      throw new Error('The image has no pixels.')
    }
    const swap = rotation === 90 || rotation === 270
    const canvas = document.createElement('canvas')
    canvas.width = swap ? bitmap.height : bitmap.width
    canvas.height = swap ? bitmap.width : bitmap.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas 2D is unavailable.')
    }
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((rotation * Math.PI) / 180)
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })
    if (!blob) {
      throw new Error('Failed to rotate the image.')
    }
    const buffer = await blob.arrayBuffer()
    return new Uint8Array(buffer)
  } finally {
    bitmap.close()
  }
}

async function addImagePage(
  output: PDFDocument,
  source: Source,
  rotation: number,
  pageSize: ImagePageSize,
): Promise<{ page: PDFPage; width: number; height: number }> {
  const normalized = (((rotation % 360) + 360) % 360)
  let data = new Uint8Array(source.bytes)
  let mimeType = source.mimeType
  if (normalized !== 0) {
    data = await rotateImageBytes(data, mimeType, normalized)
    mimeType = 'image/png'
  }

  const embedded =
    mimeType === 'image/png' ? await output.embedPng(data) : await output.embedJpg(data)
  const base = IMAGE_PAGE_SIZES[pageSize]
  const landscape = embedded.width >= embedded.height
  const pageWidth = landscape ? base.height : base.width
  const pageHeight = landscape ? base.width : base.height
  const page = output.addPage([pageWidth, pageHeight])

  const scale = Math.min(pageWidth / embedded.width, pageHeight / embedded.height)
  const drawWidth = embedded.width * scale
  const drawHeight = embedded.height * scale
  page.drawImage(embedded, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  })
  return { page, width: embedded.width, height: embedded.height }
}

export async function buildPdf(
  pages: PageRef[],
  sources: Record<string, Source>,
  options?: BuildPdfOptions,
): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error('There are no pages to export.')
  }

  const imagePageSize = options?.imagePageSize ?? 'a4'
  const pagePlacements = options?.placements ?? []
  const signatureMap = options?.signatures ?? {}
  const embeddedCache = new Map<string, PDFImage>()
  const output = await PDFDocument.create()
  for (const page of pages) {
    const source = sources[page.sourceId]
    if (!source) {
      throw new Error('A page refers to a source that is no longer loaded.')
    }

    if (source.kind === 'image') {
      const added = await addImagePage(output, source, page.rotation, imagePageSize)
      await stampPageSignatures(
        output,
        added.page,
        added.width,
        added.height,
        0,
        page.id,
        pagePlacements,
        signatureMap,
        embeddedCache,
      )
      continue
    }

    const sourceDocument = await getSourceDocument(source)
    const [copied] = await output.copyPages(sourceDocument, [page.sourcePageIndex])
    const total = (((copied.getRotation().angle + page.rotation) % 360) + 360) % 360
    copied.setRotation(degrees(total))
    const { width, height } = copied.getSize()
    await stampPageSignatures(
      output,
      copied,
      width,
      height,
      total,
      page.id,
      pagePlacements,
      signatureMap,
      embeddedCache,
    )
    output.addPage(copied)
  }

  return output.save()
}

export function suggestBaseName(
  pages: PageRef[],
  sources: Record<string, Source>,
): string {
  const firstSource = pages.length > 0 ? sources[pages[0].sourceId] : undefined
  return (
    (firstSource?.name ?? 'document').replace(/\.(pdf|jpe?g|png|webp|hei[cf])$/i, '') ||
    'document'
  )
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
