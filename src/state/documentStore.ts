import { create } from 'zustand'

import { createId } from '../lib/id'
import {
  buildPdf,
  clearExportCache,
  downloadPdf,
  suggestBaseName,
  suggestFileName,
} from '../lib/pdf/export'
import { createPdfSource, isPdfFile } from '../lib/pdf/load'
import { revokeAllThumbnails } from '../lib/pdf/pdfjs'
import type { PageRef, Source } from '../types'

export type SelectMode = 'replace' | 'toggle' | 'range'

export type InsertPosition = 'end' | 'start' | 'after-selection'

export interface AddFilesOptions {
  position?: InsertPosition
}

interface DocumentState {
  sources: Record<string, Source>
  pages: PageRef[]
  selectedIds: string[]
  lastSelectedId: string | null
  isLoading: boolean
  isExporting: boolean
  error: string | null
  addFiles: (files: File[], options?: AddFilesOptions) => Promise<void>
  clear: () => Promise<void>
  dismissError: () => void
  exportDocument: () => Promise<void>
  exportSelected: () => Promise<void>
  splitDocument: (chunkSize: number) => Promise<void>
  selectPage: (id: string, mode: SelectMode) => void
  selectAll: () => void
  clearSelection: () => void
  removeSelected: () => void
  rotateSelected: (degrees: number) => void
  reorderPages: (activeId: string, overId: string) => void
}

function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

function moveGroup(pages: PageRef[], movingIds: Set<string>, overId: string): PageRef[] {
  const moving = pages.filter((page) => movingIds.has(page.id))
  const rest = pages.filter((page) => !movingIds.has(page.id))
  const overIndexInRest = rest.findIndex((page) => page.id === overId)
  if (overIndexInRest === -1) {
    return pages
  }

  const firstMovingIndex = pages.findIndex((page) => movingIds.has(page.id))
  const overIndex = pages.findIndex((page) => page.id === overId)
  const insertAt = firstMovingIndex < overIndex ? overIndexInRest + 1 : overIndexInRest

  return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)]
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  sources: {},
  pages: [],
  selectedIds: [],
  lastSelectedId: null,
  isLoading: false,
  isExporting: false,
  error: null,

  addFiles: async (files, options) => {
    const pdfs: File[] = []
    const rejected: string[] = []
    for (const file of files) {
      if (isPdfFile(file)) {
        pdfs.push(file)
      } else {
        rejected.push(file.name)
      }
    }

    if (pdfs.length === 0) {
      if (rejected.length > 0) {
        set({
          error: `Only PDF files can be opened right now. Skipped: ${rejected.join(', ')}.`,
        })
      }
      return
    }

    set({ isLoading: true, error: null })

    const loaded: Source[] = []
    const addedPages: PageRef[] = []
    const failures: string[] = []

    for (const file of pdfs) {
      try {
        const source = await createPdfSource(file)
        loaded.push(source)
        for (let index = 0; index < source.pageCount; index += 1) {
          addedPages.push({
            id: createId(),
            sourceId: source.id,
            sourcePageIndex: index,
            rotation: 0,
          })
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }

    if (rejected.length > 0) {
      failures.push(`Skipped (not a PDF): ${rejected.join(', ')}.`)
    }

    const position = options?.position ?? 'end'

    set((state) => {
      const sources = { ...state.sources }
      for (const source of loaded) {
        sources[source.id] = source
      }

      let pages: PageRef[]
      if (position === 'start') {
        pages = [...addedPages, ...state.pages]
      } else if (position === 'after-selection' && state.selectedIds.length > 0) {
        const selected = new Set(state.selectedIds)
        let anchorEnd = -1
        state.pages.forEach((page, index) => {
          if (selected.has(page.id)) {
            anchorEnd = index
          }
        })
        pages = [
          ...state.pages.slice(0, anchorEnd + 1),
          ...addedPages,
          ...state.pages.slice(anchorEnd + 1),
        ]
      } else {
        pages = [...state.pages, ...addedPages]
      }

      return {
        sources,
        pages,
        isLoading: false,
        error: failures.length > 0 ? failures.join(' ') : null,
      }
    })
  },

  clear: async () => {
    await revokeAllThumbnails()
    clearExportCache()
    set({
      sources: {},
      pages: [],
      selectedIds: [],
      lastSelectedId: null,
      error: null,
      isLoading: false,
      isExporting: false,
    })
  },

  dismissError: () => set({ error: null }),

  exportDocument: async () => {
    const { pages, sources, isExporting } = get()
    if (pages.length === 0 || isExporting) {
      return
    }
    set({ isExporting: true, error: null })
    try {
      const bytes = await buildPdf(pages, sources)
      downloadPdf(bytes, suggestFileName(pages, sources))
      set({ isExporting: false })
    } catch (error) {
      set({
        isExporting: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  exportSelected: async () => {
    const { pages, sources, selectedIds, isExporting } = get()
    if (selectedIds.length === 0 || isExporting) {
      return
    }
    const selected = new Set(selectedIds)
    const subset = pages.filter((page) => selected.has(page.id))
    set({ isExporting: true, error: null })
    try {
      const bytes = await buildPdf(subset, sources)
      downloadPdf(bytes, suggestFileName(subset, sources, 'extract'))
      set({ isExporting: false })
    } catch (error) {
      set({
        isExporting: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  splitDocument: async (chunkSize) => {
    const { pages, sources, isExporting } = get()
    const size = Math.floor(chunkSize)
    if (isExporting) {
      return
    }
    if (pages.length === 0) {
      return
    }
    if (!(size >= 1)) {
      set({ error: 'Split size must be at least 1 page per file.' })
      return
    }
    set({ isExporting: true, error: null })
    try {
      const chunks: PageRef[][] = []
      for (let index = 0; index < pages.length; index += size) {
        chunks.push(pages.slice(index, index + size))
      }
      const base = suggestBaseName(pages, sources)
      for (let index = 0; index < chunks.length; index += 1) {
        const bytes = await buildPdf(chunks[index], sources)
        downloadPdf(bytes, `${base}-part-${index + 1}-of-${chunks.length}.pdf`)
        if (index < chunks.length - 1) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 500)
          })
        }
      }
      set({ isExporting: false })
    } catch (error) {
      set({
        isExporting: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  selectPage: (id, mode) =>
    set((state) => {
      if (mode === 'replace') {
        return { selectedIds: [id], lastSelectedId: id }
      }

      if (mode === 'toggle') {
        const isSelected = state.selectedIds.includes(id)
        return {
          selectedIds: isSelected
            ? state.selectedIds.filter((selected) => selected !== id)
            : [...state.selectedIds, id],
          lastSelectedId: id,
        }
      }

      const anchorId = state.lastSelectedId ?? id
      const anchorIndex = state.pages.findIndex((page) => page.id === anchorId)
      const targetIndex = state.pages.findIndex((page) => page.id === id)
      if (anchorIndex === -1 || targetIndex === -1) {
        return { selectedIds: [id], lastSelectedId: id }
      }

      const start = Math.min(anchorIndex, targetIndex)
      const end = Math.max(anchorIndex, targetIndex)
      return {
        selectedIds: state.pages.slice(start, end + 1).map((page) => page.id),
        lastSelectedId: anchorId,
      }
    }),

  selectAll: () => set((state) => ({ selectedIds: state.pages.map((page) => page.id) })),

  clearSelection: () => set({ selectedIds: [], lastSelectedId: null }),

  removeSelected: () =>
    set((state) => {
      if (state.selectedIds.length === 0) {
        return {}
      }
      const removeIds = new Set(state.selectedIds)
      return {
        pages: state.pages.filter((page) => !removeIds.has(page.id)),
        selectedIds: [],
        lastSelectedId: null,
      }
    }),

  rotateSelected: (degrees) =>
    set((state) => {
      if (state.selectedIds.length === 0) {
        return {}
      }
      const rotateIds = new Set(state.selectedIds)
      return {
        pages: state.pages.map((page) =>
          rotateIds.has(page.id)
            ? { ...page, rotation: normalizeRotation(page.rotation + degrees) }
            : page,
        ),
      }
    }),

  reorderPages: (activeId, overId) =>
    set((state) => {
      if (activeId === overId) {
        return {}
      }
      const activeIndex = state.pages.findIndex((page) => page.id === activeId)
      const overIndex = state.pages.findIndex((page) => page.id === overId)
      if (activeIndex === -1 || overIndex === -1) {
        return {}
      }

      const { selectedIds } = state
      const isGroupDrag =
        selectedIds.includes(activeId) &&
        selectedIds.length > 1 &&
        !selectedIds.includes(overId)

      if (!isGroupDrag) {
        const pages = [...state.pages]
        const [moved] = pages.splice(activeIndex, 1)
        pages.splice(overIndex, 0, moved)
        return { pages }
      }

      return { pages: moveGroup(state.pages, new Set(selectedIds), overId) }
    }),
}))
