const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']

export const IMAGE_ACCEPT =
  'application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp,image/heic,.heic,image/heif,.heif'

export function isImageFile(file: File): boolean {
  if (IMAGE_MIME_TYPES.has(file.type)) {
    return true
  }
  const name = file.name.toLowerCase()
  return IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export function isHeicFile(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.hei[cf]$/i.test(file.name)
  )
}

export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${file.name} could not be decoded as an image (${detail}).`)
  }
}

export async function bitmapToPngBytes(bitmap: ImageBitmap): Promise<ArrayBuffer> {
  if (bitmap.width === 0 || bitmap.height === 0) {
    throw new Error('The image has no pixels.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D is unavailable.')
  }
  context.drawImage(bitmap, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  if (!blob) {
    throw new Error('Failed to encode the image as PNG.')
  }
  return blob.arrayBuffer()
}

export async function convertHeicFile(file: File): Promise<ArrayBuffer> {
  // Loaded lazily: the libheif wasm bundle is ~1.3 MB and only needed for HEIC.
  const { default: heic2any } = await import('heic2any')
  let result: Blob | Blob[]
  try {
    result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${file.name} could not be converted from HEIC (${detail}).`)
  }
  const blob = Array.isArray(result) ? result[0] : result
  if (!blob) {
    throw new Error(`${file.name} produced no image data when converted from HEIC.`)
  }
  return blob.arrayBuffer()
}
