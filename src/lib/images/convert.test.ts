import { describe, expect, it } from 'vitest'

import { isHeicFile, isImageFile } from './convert'

function file(name: string, type: string): File {
  return new File([new Uint8Array([1])], name, { type })
}

describe('isImageFile', () => {
  it('accepts supported image mime types', () => {
    expect(isImageFile(file('a.jpg', 'image/jpeg'))).toBe(true)
    expect(isImageFile(file('a.png', 'image/png'))).toBe(true)
    expect(isImageFile(file('a.webp', 'image/webp'))).toBe(true)
    expect(isImageFile(file('a.heic', 'image/heic'))).toBe(true)
    expect(isImageFile(file('a.heif', 'image/heif'))).toBe(true)
  })

  it('accepts supported extensions when the mime type is missing', () => {
    expect(isImageFile(file('PHOTO.HEIC', ''))).toBe(true)
    expect(isImageFile(file('scan.WebP', ''))).toBe(true)
    expect(isImageFile(file('a.png', ''))).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isImageFile(file('a.pdf', 'application/pdf'))).toBe(false)
    expect(isImageFile(file('a.gif', 'image/gif'))).toBe(false)
    expect(isImageFile(file('a.txt', 'text/plain'))).toBe(false)
    expect(isImageFile(file('a.bin', ''))).toBe(false)
  })
})

describe('isHeicFile', () => {
  it('detects heic and heif by mime or extension', () => {
    expect(isHeicFile(file('a.heic', 'image/heic'))).toBe(true)
    expect(isHeicFile(file('a.HEIF', ''))).toBe(true)
    expect(isHeicFile(file('a.jpg', 'image/jpeg'))).toBe(false)
  })
})
