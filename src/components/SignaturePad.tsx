import { useRef, useState } from 'react'

import { cropCanvasToContent } from '../lib/signatures/crop'
import type { CroppedImage } from '../lib/signatures/crop'

const PAD_WIDTH = 600
const PAD_HEIGHT = 220
const STROKE_COLOR = '#1a1a1a'
const STROKE_WIDTH = 3

interface SignaturePadProps {
  onSave: (image: CroppedImage) => void
}

export function SignaturePad({ onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const setupContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(PAD_WIDTH * dpr)) {
      canvas.width = Math.round(PAD_WIDTH * dpr)
      canvas.height = Math.round(PAD_HEIGHT * dpr)
    }
    const context = canvas.getContext('2d')
    if (context) {
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.strokeStyle = STROKE_COLOR
      context.lineWidth = STROKE_WIDTH
      context.lineCap = 'round'
      context.lineJoin = 'round'
    }
    return context
  }

  const toPadPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * PAD_WIDTH,
      y: ((clientY - rect.top) / rect.height) * PAD_HEIGHT,
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas || !setupContext(canvas)) {
      return
    }
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is best-effort; drawing still works without it.
    }
    drawingRef.current = true
    lastRef.current = toPadPoint(canvas, event.clientX, event.clientY)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) {
      return
    }
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const last = lastRef.current
    if (!canvas || !context || !last) {
      return
    }
    const next = toPadPoint(canvas, event.clientX, event.clientY)
    context.beginPath()
    context.moveTo(last.x, last.y)
    context.lineTo(next.x, next.y)
    context.stroke()
    lastRef.current = next
    setDirty(true)
  }

  const endStroke = () => {
    drawingRef.current = false
    lastRef.current = null
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) {
      context.save()
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.restore()
    }
    endStroke()
    setDirty(false)
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas || !dirty || saving) {
      return
    }
    setSaving(true)
    try {
      const cropped = await cropCanvasToContent(canvas)
      if (cropped) {
        onSave(cropped)
        handleClear()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        className="signature-pad__canvas"
        width={PAD_WIDTH}
        height={PAD_HEIGHT}
        aria-label="Draw your signature"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      />
      <div className="signature-pad__actions">
        <button type="button" className="button button--ghost" onClick={handleClear}>
          Clear
        </button>
        <button
          type="button"
          className="button"
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save signature'}
        </button>
      </div>
    </div>
  )
}
