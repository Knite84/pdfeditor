import { PDFDocument } from 'pdf-lib'
import { beforeEach, describe, expect, it } from 'vitest'

import type { PageRef, Source } from '../../types'
import { buildPdf, clearExportCache, suggestFileName } from './export'

async function makeSource(name: string, pageCount: number): Promise<Source> {
  const document = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([200, 300])
  }
  const saved = await document.save()
  const bytes = new Uint8Array(saved.byteLength)
  bytes.set(saved)
  return {
    id: `source-${name}`,
    kind: 'pdf',
    name,
    bytes: bytes.buffer,
    pageCount,
  }
}

function ref(source: Source, sourcePageIndex: number, rotation = 0, id?: string): PageRef {
  return {
    id: id ?? `ref-${source.id}-${sourcePageIndex}-${rotation}`,
    sourceId: source.id,
    sourcePageIndex,
    rotation,
  }
}

beforeEach(() => {
  clearExportCache()
})

describe('buildPdf', () => {
  it('exports pages in the given order', async () => {
    const source = await makeSource('a.pdf', 3)
    const sources = { [source.id]: source }
    const bytes = await buildPdf(
      [ref(source, 2), ref(source, 0), ref(source, 2)],
      sources,
    )

    const output = await PDFDocument.load(bytes)
    expect(output.getPageCount()).toBe(3)
  })

  it('merges pages from multiple sources in order', async () => {
    const first = await makeSource('a.pdf', 1)
    const second = await makeSource('b.pdf', 2)
    const sources = { [first.id]: first, [second.id]: second }
    const bytes = await buildPdf(
      [ref(second, 1), ref(first, 0), ref(second, 0)],
      sources,
    )

    const output = await PDFDocument.load(bytes)
    expect(output.getPageCount()).toBe(3)
  })

  it('applies page rotations on top of the source rotation', async () => {
    const source = await makeSource('a.pdf', 1)
    const sources = { [source.id]: source }
    const bytes = await buildPdf([ref(source, 0, 270)], sources)

    const output = await PDFDocument.load(bytes)
    expect(output.getPage(0).getRotation().angle).toBe(270)
  })

  it('rejects empty page lists', async () => {
    await expect(buildPdf([], {})).rejects.toThrow(/no pages/i)
  })

  it('rejects pages whose source is missing', async () => {
    const ghost: PageRef = { id: 'ghost', sourceId: 'gone', sourcePageIndex: 0, rotation: 0 }
    await expect(buildPdf([ghost], {})).rejects.toThrow(/no longer loaded/i)
  })

  it('rejects non-pdf sources', async () => {
    const source = await makeSource('photo.png', 1)
    const image: Source = { ...source, kind: 'image' }
    await expect(buildPdf([ref(image, 0)], { [image.id]: image })).rejects.toThrow(
      /not a PDF/i,
    )
  })
})

describe('suggestFileName', () => {
  it('derives -edited from a single source name', async () => {
    const source = await makeSource('Report.PDF', 2)
    expect(suggestFileName([ref(source, 0)], { [source.id]: source })).toBe(
      'Report-edited.pdf',
    )
  })

  it('derives -merged when multiple sources are involved', async () => {
    const first = await makeSource('a.pdf', 1)
    const second = await makeSource('b.pdf', 1)
    const sources = { [first.id]: first, [second.id]: second }
    expect(
      suggestFileName([ref(first, 0), ref(second, 0)], sources),
    ).toBe('a-merged.pdf')
  })

  it('falls back to a generic name without pages', () => {
    expect(suggestFileName([], {})).toBe('document-edited.pdf')
  })

  it('uses an explicit label like extract when provided', async () => {
    const source = await makeSource('Report.pdf', 2)
    expect(suggestFileName([ref(source, 0)], { [source.id]: source }, 'extract')).toBe(
      'Report-extract.pdf',
    )
  })
})
