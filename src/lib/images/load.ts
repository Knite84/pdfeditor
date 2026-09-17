import { createId } from '../id'
import type { Source } from '../../types'
import { bitmapToPngBytes, convertHeicFile, decodeImage, isHeicFile } from './convert'

export { isImageFile } from './convert'

function imageSource(name: string, bytes: ArrayBuffer, mimeType: string): Source {
  return {
    id: createId(),
    kind: 'image',
    name,
    bytes,
    pageCount: 1,
    mimeType,
  }
}

export async function createImageSource(file: File): Promise<Source> {
  if (file.size === 0) {
    throw new Error(`${file.name} is empty.`)
  }

  if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) {
    const bitmap = await decodeImage(file)
    bitmap.close()
    return imageSource(file.name, await file.arrayBuffer(), 'image/jpeg')
  }

  if (file.type === 'image/png' || /\.png$/i.test(file.name)) {
    const bitmap = await decodeImage(file)
    bitmap.close()
    return imageSource(file.name, await file.arrayBuffer(), 'image/png')
  }

  if (isHeicFile(file)) {
    const bytes = await convertHeicFile(file)
    return imageSource(file.name, bytes, 'image/jpeg')
  }

  // Anything else decodable (e.g. WebP) is normalized to PNG.
  const bitmap = await decodeImage(file)
  try {
    const bytes = await bitmapToPngBytes(bitmap)
    return imageSource(file.name, bytes, 'image/png')
  } finally {
    bitmap.close()
  }
}
