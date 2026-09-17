export type SourceKind = 'pdf' | 'image'

export interface Source {
  id: string
  kind: SourceKind
  name: string
  bytes: ArrayBuffer
  pageCount: number
}

export interface PageRef {
  id: string
  sourceId: string
  sourcePageIndex: number
  rotation: number
}
