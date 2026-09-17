import { PDFDocument } from 'pdf-lib'
import { beforeEach, describe, expect, it } from 'vitest'

import type { PageRef, SignatureAsset, Source } from '../../types'
import { buildPdf, clearExportCache, mapSignatureRect, suggestFileName } from './export'

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
    mimeType: 'application/pdf',
  }
}

// A real 3x2 red PNG fixture for image-page tests.
const RECT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAEElEQVR4nGM4IScHQQxwFgBBAAYZPEVBlgAAAABJRU5ErkJggg=='

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function makeImageSource(name: string): Source {
  return {
    id: `source-${name}`,
    kind: 'image',
    name,
    bytes: decodeBase64(RECT_PNG_BASE64),
    pageCount: 1,
    mimeType: 'image/png',
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

  it('exports an image page sized to the image orientation', async () => {
    const image = makeImageSource('photo.png')
    const bytes = await buildPdf([ref(image, 0)], { [image.id]: image })

    const output = await PDFDocument.load(bytes)
    expect(output.getPageCount()).toBe(1)
    const { width, height } = output.getPage(0).getSize()
    expect(width).toBeCloseTo(841.89, 1)
    expect(height).toBeCloseTo(595.28, 1)
  })

  it('uses letter size for image pages when requested', async () => {
    const image = makeImageSource('photo.png')
    const bytes = await buildPdf([ref(image, 0)], { [image.id]: image }, { imagePageSize: 'letter' })

    const output = await PDFDocument.load(bytes)
    const { width, height } = output.getPage(0).getSize()
    expect(width).toBeCloseTo(792, 1)
    expect(height).toBeCloseTo(612, 1)
  })

  it.runIf(typeof createImageBitmap === 'function' && typeof document !== 'undefined')(
    'rotates image pages onto a matching page orientation',
    async () => {
      const image = makeImageSource('photo.png')
      const bytes = await buildPdf([ref(image, 0, 90)], { [image.id]: image })

      const output = await PDFDocument.load(bytes)
      expect(output.getPageCount()).toBe(1)
      const { width, height } = output.getPage(0).getSize()
      expect(width).toBeCloseTo(595.28, 1)
      expect(height).toBeCloseTo(841.89, 1)
    },
  )
})

describe('mapSignatureRect', () => {
  it('maps fractions to points without rotation', () => {
    expect(mapSignatureRect({ x: 0.5, y: 0.25, width: 0.5, height: 0.5 }, 100, 200, 0)).toEqual(
      { x: 50, y: 50, width: 50, height: 100 },
    )
  })

  it('covers the full page for every rotation', () => {
    const full = { x: 0, y: 0, width: 1, height: 1 }
    for (const rotation of [0, 90, 180, 270, 360, -90]) {
      expect(mapSignatureRect(full, 100, 200, rotation)).toEqual(
        { x: 0, y: 0, width: 100, height: 200 },
      )
    }
  })

  it('inverse-rotates rects on rotated pages', () => {
    expect(mapSignatureRect({ x: 0, y: 0, width: 0.5, height: 0.5 }, 100, 200, 90)).toEqual(
      { x: 0, y: 0, width: 50, height: 100 },
    )
    expect(
      mapSignatureRect({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 100, 200, 180),
    ).toEqual({ x: 25, y: 50, width: 50, height: 100 })
    expect(mapSignatureRect({ x: 0, y: 0, width: 0.5, height: 0.5 }, 100, 200, 270)).toEqual(
      { x: 50, y: 100, width: 50, height: 100 },
    )
  })
})

function makeSignature(id: string): SignatureAsset {
  return {
    id,
    name: id,
    pngBytes: decodeBase64(RECT_PNG_BASE64),
    width: 3,
    height: 2,
  }
}

describe('buildPdf signatures', () => {
  it('stamps placements onto pdf pages, including rotated ones', async () => {
    const source = await makeSource('a.pdf', 2)
    const sources = { [source.id]: source }
    const pages = [ref(source, 0, 0, 'p0'), ref(source, 1, 90, 'p1')]
    const bytes = await buildPdf(pages, sources, {
      placements: [
        { id: 's1', pageId: 'p0', signatureId: 'sig-1', x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
        { id: 's2', pageId: 'p1', signatureId: 'sig-1', x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
        { id: 's3', pageId: 'p0', signatureId: 'missing', x: 0, y: 0, width: 0.1, height: 0.1 },
        { id: 's4', pageId: 'elsewhere', signatureId: 'sig-1', x: 0, y: 0, width: 0.1, height: 0.1 },
      ],
      signatures: { 'sig-1': makeSignature('sig-1') },
    })

    const output = await PDFDocument.load(bytes)
    expect(output.getPageCount()).toBe(2)
    expect(output.getPage(1).getRotation().angle).toBe(90)
  })

  it('stamps placements onto image pages', async () => {
    const image = makeImageSource('photo.png')
    const bytes = await buildPdf([ref(image, 0, 0, 'p0')], { [image.id]: image }, {
      placements: [
        { id: 's1', pageId: 'p0', signatureId: 'sig-1', x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
      ],
      signatures: { 'sig-1': makeSignature('sig-1') },
    })

    const output = await PDFDocument.load(bytes)
    expect(output.getPageCount()).toBe(1)
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
