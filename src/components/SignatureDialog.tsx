import { useRef, useState } from 'react'

import { signatureObjectUrl } from '../lib/signatures/assets'
import { cropCanvasToContent } from '../lib/signatures/crop'
import type { CroppedImage } from '../lib/signatures/crop'
import { useDocumentStore } from '../state/documentStore'
import { Dialog } from './Dialog'
import { SignaturePad } from './SignaturePad'

const UPLOAD_MAX_DIMENSION = 1200
const WHITE_THRESHOLD = 235

interface SignatureDialogProps {
  onClose: () => void
}

export function SignatureDialog({ onClose }: SignatureDialogProps) {
  const signatures = useDocumentStore((state) => state.signatures)
  const addSignature = useDocumentStore((state) => state.addSignature)
  const removeSignature = useDocumentStore((state) => state.removeSignature)
  const setPlacingSignatureId = useDocumentStore((state) => state.setPlacingSignatureId)

  const [removeWhiteBackground, setRemoveWhiteBackground] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)

  const handlePadSave = (image: CroppedImage) => {
    addSignature({
      name: `Signature ${signatures.length + 1}`,
      pngBytes: image.pngBytes,
      width: image.width,
      height: image.height,
    })
  }

  const handlePlace = (id: string) => {
    setPlacingSignatureId(id)
    onClose()
  }

  const handleUploadFile = async (file: File | undefined) => {
    if (!file || uploading) {
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const bitmap = await createImageBitmap(file)
      try {
        const scale = Math.min(
          1,
          UPLOAD_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
        )
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Canvas 2D is unavailable.')
        }
        context.drawImage(bitmap, 0, 0, width, height)
        if (removeWhiteBackground) {
          const imageData = context.getImageData(0, 0, width, height)
          const pixels = imageData.data
          for (let index = 0; index < pixels.length; index += 4) {
            if (
              pixels[index] > WHITE_THRESHOLD &&
              pixels[index + 1] > WHITE_THRESHOLD &&
              pixels[index + 2] > WHITE_THRESHOLD
            ) {
              pixels[index + 3] = 0
            }
          }
          context.putImageData(imageData, 0, 0)
        }
        const cropped = await cropCanvasToContent(canvas)
        if (!cropped) {
          throw new Error('No signature content found in the image.')
        }
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'Uploaded signature'
        addSignature({
          name: baseName,
          pngBytes: cropped.pngBytes,
          width: cropped.width,
          height: cropped.height,
        })
      } finally {
        bitmap.close()
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog title="Signatures" onClose={onClose}>
      {signatures.length > 0 ? (
        <ul className="signature-list">
          {signatures.map((signature) => (
            <li key={signature.id} className="signature-list__item">
              <img
                className="signature-list__preview"
                src={signatureObjectUrl(signature)}
                alt={signature.name}
              />
              <span className="signature-list__name">{signature.name}</span>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => handlePlace(signature.id)}
              >
                Place
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => removeSignature(signature.id)}
                aria-label={`Delete ${signature.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dialog__hint">No signatures yet. Draw one below or upload an image.</p>
      )}

      <div className="dialog__group">
        <span className="dialog__legend">Draw a signature</span>
        <SignaturePad onSave={handlePadSave} />
      </div>

      <div className="dialog__group">
        <span className="dialog__legend">Upload an image</span>
        <button
          type="button"
          className="button button--ghost"
          disabled={uploading}
          onClick={() => uploadRef.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Choose image'}
        </button>
        <input
          ref={uploadRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,.png,.jpg,.jpeg"
          onChange={(event) => {
            void handleUploadFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <label className="dialog__option">
          <input
            type="checkbox"
            checked={removeWhiteBackground}
            onChange={(event) => setRemoveWhiteBackground(event.target.checked)}
          />
          Make white background transparent
        </label>
        {uploadError ? <p className="dialog__error">{uploadError}</p> : null}
      </div>

      <div className="dialog__actions">
        <button type="button" className="button button--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  )
}
