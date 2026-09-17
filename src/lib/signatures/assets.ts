import type { SignatureAsset } from '../../types'

const urlCache = new Map<string, string>()

export function signatureObjectUrl(asset: SignatureAsset): string {
  let url = urlCache.get(asset.id)
  if (!url) {
    url = URL.createObjectURL(new Blob([asset.pngBytes], { type: 'image/png' }))
    urlCache.set(asset.id, url)
  }
  return url
}

export function revokeSignatureUrl(id: string): void {
  const url = urlCache.get(id)
  urlCache.delete(id)
  if (url) {
    URL.revokeObjectURL(url)
  }
}

export function revokeAllSignatureUrls(): void {
  for (const id of [...urlCache.keys()]) {
    revokeSignatureUrl(id)
  }
}
