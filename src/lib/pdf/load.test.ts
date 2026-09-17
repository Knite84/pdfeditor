import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { createPdfSource, isPdfFile } from './load'

async function makePdfFile(name: string, pageCount: number): Promise<File> {
  const document = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([200, 300])
  }
  const bytes = await document.save()
  return new File([bytes as BlobPart], name, { type: 'application/pdf' })
}

describe('isPdfFile', () => {
  it('accepts pdf mime types and .pdf extensions', () => {
    expect(isPdfFile(new File([], 'a.pdf', { type: 'application/pdf' }))).toBe(true)
    expect(isPdfFile(new File([], 'b.PDF', { type: '' }))).toBe(true)
  })

  it('rejects non-pdf files', () => {
    expect(isPdfFile(new File([], 'photo.png', { type: 'image/png' }))).toBe(false)
  })
})

describe('createPdfSource', () => {
  it('reads the page count and preserves the bytes', async () => {
    const file = await makePdfFile('three.pdf', 3)
    const source = await createPdfSource(file)

    expect(source.kind).toBe('pdf')
    expect(source.mimeType).toBe('application/pdf')
    expect(source.name).toBe('three.pdf')
    expect(source.pageCount).toBe(3)
    expect(source.bytes.byteLength).toBeGreaterThan(0)
    expect(source.id).toBeTruthy()
  })

  it('rejects empty files', async () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' })
    await expect(createPdfSource(file)).rejects.toThrow(/is empty/)
  })

  it('rejects bytes that are not a PDF', async () => {
    const file = new File([new TextEncoder().encode('nope')], 'bad.pdf', {
      type: 'application/pdf',
    })
    await expect(createPdfSource(file)).rejects.toThrow(/not a readable PDF/)
  })
})
