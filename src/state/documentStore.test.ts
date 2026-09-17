import { PDFDocument } from 'pdf-lib'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/pdf/pdfjs', () => ({
  revokeAllThumbnails: vi.fn().mockResolvedValue(undefined),
  revokeSourceThumbnails: vi.fn().mockResolvedValue(undefined),
  getPageThumbnail: vi.fn(),
}))

import { useDocumentStore } from './documentStore'
import type { PageRef } from '../types'

async function makePdfFile(name: string, pageCount: number): Promise<File> {
  const document = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([200, 300])
  }
  const bytes = await document.save()
  return new File([bytes as BlobPart], name, { type: 'application/pdf' })
}

beforeEach(() => {
  useDocumentStore.setState({
    sources: {},
    pages: [],
    error: null,
    isLoading: false,
    isExporting: false,
    selectedIds: [],
    lastSelectedId: null,
  })
})

function seedPages(count: number): string[] {
  const pages: PageRef[] = Array.from({ length: count }, (_, index) => ({
    id: `page-${index}`,
    sourceId: 'source-1',
    sourcePageIndex: index,
    rotation: 0,
  }))
  useDocumentStore.setState({
    sources: {},
    pages,
    selectedIds: [],
    lastSelectedId: null,
  })
  return pages.map((page) => page.id)
}

describe('documentStore.addFiles', () => {
  it('registers a source and one page ref per PDF page', async () => {
    const files = [await makePdfFile('a.pdf', 3), await makePdfFile('b.pdf', 2)]
    await useDocumentStore.getState().addFiles(files)

    const state = useDocumentStore.getState()
    expect(Object.keys(state.sources)).toHaveLength(2)
    expect(state.pages).toHaveLength(5)
    expect(state.error).toBeNull()
    expect(state.isLoading).toBe(false)

    const sourceIds = new Set(state.pages.map((page) => page.sourceId))
    expect(sourceIds.size).toBe(2)
    expect(state.pages[0]?.sourcePageIndex).toBe(0)
    expect(state.pages[3]?.sourcePageIndex).toBe(0)
    expect(state.pages.every((page) => page.rotation === 0)).toBe(true)
  })

  it('rejects non-pdf files without adding pages', async () => {
    const png = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' })
    await useDocumentStore.getState().addFiles([png])

    const state = useDocumentStore.getState()
    expect(state.pages).toHaveLength(0)
    expect(state.error).toMatch(/Only PDF files/)
  })

  it('keeps valid files when a batch contains unsupported ones', async () => {
    const pdf = await makePdfFile('ok.pdf', 1)
    const png = new File([new Uint8Array([1])], 'skip.png', { type: 'image/png' })
    await useDocumentStore.getState().addFiles([pdf, png])

    const state = useDocumentStore.getState()
    expect(state.pages).toHaveLength(1)
    expect(state.error).toMatch(/Skipped \(not a PDF\)/)
  })

  it('prepends new pages when position is start', async () => {
    const store = useDocumentStore.getState()
    await store.addFiles([await makePdfFile('a.pdf', 2)])
    await store.addFiles([await makePdfFile('b.pdf', 1)], { position: 'start' })

    const state = useDocumentStore.getState()
    expect(state.pages).toHaveLength(3)
    expect(state.pages[0]?.sourcePageIndex).toBe(0)
    expect(state.pages[0]?.sourceId).not.toBe(state.pages[1]?.sourceId)
  })

  it('inserts new pages after the selection', async () => {
    const store = useDocumentStore.getState()
    await store.addFiles([await makePdfFile('a.pdf', 3)])
    const ids = useDocumentStore.getState().pages.map((page) => page.id)
    useDocumentStore.getState().selectPage(ids[0], 'replace')
    await store.addFiles([await makePdfFile('b.pdf', 1)], { position: 'after-selection' })

    const state = useDocumentStore.getState()
    expect(state.pages).toHaveLength(4)
    expect(state.pages[0]?.id).toBe(ids[0])
    expect(state.pages[1]?.id).not.toBe(ids[1])
    expect(state.pages.slice(2).map((page) => page.id)).toEqual([ids[1], ids[2]])
  })

  it('appends when after-selection has no selection', async () => {
    const store = useDocumentStore.getState()
    await store.addFiles([await makePdfFile('a.pdf', 1)])
    await store.addFiles([await makePdfFile('b.pdf', 1)], { position: 'after-selection' })

    const state = useDocumentStore.getState()
    expect(state.pages).toHaveLength(2)
    expect(state.pages[0]?.sourcePageIndex).toBe(0)
    expect(state.pages[1]?.sourcePageIndex).toBe(0)
    expect(state.pages[0]?.sourceId).not.toBe(state.pages[1]?.sourceId)
  })
})

describe('documentStore.selectPage', () => {
  it('replaces the selection in replace mode', () => {
    const [a, b] = seedPages(3)
    const store = useDocumentStore.getState()
    store.selectPage(a, 'replace')
    expect(useDocumentStore.getState().selectedIds).toEqual([a])
    store.selectPage(b, 'replace')
    expect(useDocumentStore.getState().selectedIds).toEqual([b])
  })

  it('toggles individual pages in toggle mode', () => {
    const [a, b] = seedPages(3)
    const store = useDocumentStore.getState()
    store.selectPage(a, 'toggle')
    store.selectPage(b, 'toggle')
    expect(useDocumentStore.getState().selectedIds).toEqual([a, b])
    store.selectPage(a, 'toggle')
    expect(useDocumentStore.getState().selectedIds).toEqual([b])
  })

  it('selects an inclusive range from the anchor in range mode', () => {
    const [a, b, c] = seedPages(3)
    const store = useDocumentStore.getState()
    store.selectPage(a, 'replace')
    store.selectPage(c, 'range')
    expect(useDocumentStore.getState().selectedIds).toEqual([a, b, c])
  })
})

describe('documentStore.rotateSelected', () => {
  it('rotates only selected pages and normalizes wraps', () => {
    const [a, , c] = seedPages(3)
    const store = useDocumentStore.getState()
    store.selectPage(a, 'toggle')
    store.selectPage(c, 'toggle')
    store.rotateSelected(90)
    store.rotateSelected(270)

    const rotations = useDocumentStore.getState().pages.map((page) => page.rotation)
    expect(rotations).toEqual([0, 0, 0])

    store.rotateSelected(450)
    expect(useDocumentStore.getState().pages.map((page) => page.rotation)).toEqual([90, 0, 90])
  })

  it('does nothing without a selection', () => {
    seedPages(2)
    useDocumentStore.getState().rotateSelected(90)
    expect(useDocumentStore.getState().pages.map((page) => page.rotation)).toEqual([0, 0])
  })
})

describe('documentStore.removeSelected', () => {
  it('removes selected pages and clears the selection', () => {
    const [a, , c] = seedPages(3)
    const store = useDocumentStore.getState()
    store.selectPage(a, 'replace')
    store.selectPage(c, 'toggle')
    store.removeSelected()

    const state = useDocumentStore.getState()
    expect(state.pages.map((page) => page.id)).toEqual(['page-1'])
    expect(state.selectedIds).toEqual([])
    expect(state.lastSelectedId).toBeNull()
  })

  it('leaves pages alone without a selection', () => {
    seedPages(2)
    useDocumentStore.getState().removeSelected()
    expect(useDocumentStore.getState().pages).toHaveLength(2)
  })
})

describe('documentStore.reorderPages', () => {
  it('moves a single page to the drop position', () => {
    const [a, b, c] = seedPages(3)
    useDocumentStore.getState().reorderPages(a, c)
    expect(useDocumentStore.getState().pages.map((page) => page.id)).toEqual([b, c, a])
  })

  it('moves a selected group when dragging a selected page', () => {
    const [a, b, , d] = seedPages(4)
    const store = useDocumentStore.getState()
    store.selectPage(a, 'replace')
    store.selectPage(b, 'toggle')
    store.reorderPages(a, d)
    expect(useDocumentStore.getState().pages.map((page) => page.id)).toEqual([
      'page-2',
      d,
      a,
      b,
    ])
  })

  it('ignores drops on the same page or unknown ids', () => {
    const ids = seedPages(3)
    const store = useDocumentStore.getState()
    store.reorderPages(ids[0], ids[0])
    store.reorderPages('missing', ids[1])
    store.reorderPages(ids[0], 'missing')
    expect(useDocumentStore.getState().pages.map((page) => page.id)).toEqual(ids)
  })
})

describe('documentStore.exportSelected', () => {
  it('is a no-op without a selection', async () => {
    seedPages(2)
    await useDocumentStore.getState().exportSelected()
    const state = useDocumentStore.getState()
    expect(state.isExporting).toBe(false)
    expect(state.error).toBeNull()
    expect(state.pages).toHaveLength(2)
  })
})

describe('documentStore.splitDocument', () => {
  it('rejects chunk sizes below one page without touching the document', async () => {
    seedPages(3)
    await useDocumentStore.getState().splitDocument(0)
    const state = useDocumentStore.getState()
    expect(state.error).toMatch(/at least 1/)
    expect(state.isExporting).toBe(false)
    expect(state.pages).toHaveLength(3)
  })

  it('is a no-op without pages', async () => {
    await useDocumentStore.getState().splitDocument(2)
    expect(useDocumentStore.getState().error).toBeNull()
  })
})
