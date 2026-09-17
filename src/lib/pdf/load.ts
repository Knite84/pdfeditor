import { EncryptedPDFError, PDFDocument } from 'pdf-lib'

import { createId } from '../id'
import type { Source } from '../../types'

export function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') {
    return true
  }
  return file.name.toLowerCase().endsWith('.pdf')
}

export async function createPdfSource(file: File): Promise<Source> {
  const bytes = await file.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error(`${file.name} is empty.`)
  }

  let document: PDFDocument
  try {
    document = await PDFDocument.load(bytes.slice(0))
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw new Error(`${file.name} is password-protected and cannot be opened.`)
    }
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${file.name} is not a readable PDF (${detail}).`)
  }

  return {
    id: createId(),
    kind: 'pdf',
    name: file.name,
    bytes,
    pageCount: document.getPageCount(),
  }
}
