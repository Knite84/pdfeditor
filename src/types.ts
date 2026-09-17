export type SourceKind = 'pdf' | 'image'

export interface Source {
  id: string
  kind: SourceKind
  name: string
  bytes: ArrayBuffer
  pageCount: number
  /** 'application/pdf' for PDFs; the normalized 'image/jpeg' or 'image/png' for images. */
  mimeType: string
}

export type ImagePageSize = 'a4' | 'letter'

export interface SignatureAsset {
  id: string
  name: string
  /** PNG bytes with transparency. */
  pngBytes: ArrayBuffer
  /** Natural pixel dimensions, used to preserve aspect ratio. */
  width: number
  height: number
}

export interface SignaturePlacement {
  id: string
  pageId: string
  signatureId: string
  /** Fractions (0-1) of the displayed page, top-left origin. */
  x: number
  y: number
  width: number
  height: number
}

export interface PageRef {
  id: string
  sourceId: string
  sourcePageIndex: number
  rotation: number
}
