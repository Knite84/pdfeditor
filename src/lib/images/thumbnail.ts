import type { Source } from '../../types'

export async function renderImageThumbnail(
  source: Source,
  width: number,
  dpr: number,
  rotation: number,
): Promise<string> {
  const bitmap = await createImageBitmap(new Blob([source.bytes], { type: source.mimeType }))
  try {
    if (bitmap.width === 0 || bitmap.height === 0) {
      throw new Error(`${source.name} has no pixels to preview.`)
    }
    const normalized = ((rotation % 360) + 360) % 360
    const swap = normalized === 90 || normalized === 270
    const scale = (width * dpr) / (swap ? bitmap.height : bitmap.width)

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round((swap ? bitmap.height : bitmap.width) * scale))
    canvas.height = Math.max(1, Math.round((swap ? bitmap.width : bitmap.height) * scale))

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas 2D is unavailable.')
    }
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((normalized * Math.PI) / 180)
    context.drawImage(
      bitmap,
      (-bitmap.width * scale) / 2,
      (-bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    )

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })
    if (!blob) {
      throw new Error('Failed to encode the image preview.')
    }
    return URL.createObjectURL(blob)
  } finally {
    bitmap.close()
  }
}
