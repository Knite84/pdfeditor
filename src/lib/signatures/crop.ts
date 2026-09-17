export interface CroppedImage {
  pngBytes: ArrayBuffer
  width: number
  height: number
}

const ALPHA_THRESHOLD = 12

export async function cropCanvasToContent(
  canvas: HTMLCanvasElement,
  padding = 12,
): Promise<CroppedImage | null> {
  const { width, height } = canvas
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D is unavailable.')
  }
  const pixels = context.getImageData(0, 0, width, height).data

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) {
          minX = x
        }
        if (y < minY) {
          minY = y
        }
        if (x > maxX) {
          maxX = x
        }
        if (y > maxY) {
          maxY = y
        }
      }
    }
  }
  if (maxX === -1) {
    return null
  }

  const x0 = Math.max(0, minX - padding)
  const y0 = Math.max(0, minY - padding)
  const x1 = Math.min(width, maxX + 1 + padding)
  const y1 = Math.min(height, maxY + 1 + padding)

  const cropped = document.createElement('canvas')
  cropped.width = Math.max(1, x1 - x0)
  cropped.height = Math.max(1, y1 - y0)
  const croppedContext = cropped.getContext('2d')
  if (!croppedContext) {
    throw new Error('Canvas 2D is unavailable.')
  }
  croppedContext.drawImage(canvas, x0, y0, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)

  const blob = await new Promise<Blob | null>((resolve) => {
    cropped.toBlob(resolve, 'image/png')
  })
  if (!blob) {
    throw new Error('Failed to encode the signature.')
  }
  return { pngBytes: await blob.arrayBuffer(), width: cropped.width, height: cropped.height }
}
