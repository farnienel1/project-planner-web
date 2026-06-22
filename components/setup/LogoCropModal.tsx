'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const MAX_OUTPUT_EDGE = 1024
const MAX_DISPLAY_WIDTH = 400

type CropRect = { x: number; y: number; w: number; h: number }

type LogoCropModalProps = {
  file: File
  onCancel: () => void
  onConfirm: (croppedFile: File) => void
}

async function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
  return pdfjs
}

async function fileToImageSource(file: File): Promise<{ src: string; revoke?: () => void }> {
  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    const src = URL.createObjectURL(file)
    return { src, revoke: () => URL.revokeObjectURL(src) }
  }

  const pdfjs = await loadPdfJs()
  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare PDF preview.')
  await page.render({ canvasContext: ctx, viewport }).promise
  return { src: canvas.toDataURL('image/png') }
}

export function LogoCropModal({ file, onCancel, onConfirm }: LogoCropModalProps) {
  const [mounted, setMounted] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 200, h: 120 })
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [display, setDisplay] = useState({ w: 0, h: 0 })
  const [drag, setDrag] = useState<{
    mode: 'move' | 'resize'
    startX: number
    startY: number
    startCrop: CropRect
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const initCrop = useCallback((imgW: number, imgH: number, dispW: number, dispH: number) => {
    const w = dispW * 0.85
    const h = dispH * 0.55
    setCrop({
      x: (dispW - w) / 2,
      y: (dispH - h) / 2,
      w,
      h,
    })
    setNatural({ w: imgW, h: imgH })
    setDisplay({ w: dispW, h: dispH })
  }, [])

  useEffect(() => {
    let revoke: (() => void) | undefined
    let cancelled = false

    void (async () => {
      try {
        const { src, revoke: r } = await fileToImageSource(file)
        revoke = r
        if (cancelled) return
        setImageSrc(src)
      } catch {
        if (!cancelled) setError('Could not load this file. Try a JPEG or PNG image.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      revoke?.()
    }
  }, [file])

  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_DISPLAY_WIDTH / img.width)
      const dispW = Math.max(1, Math.round(img.width * scale))
      const dispH = Math.max(1, Math.round(img.height * scale))
      initCrop(img.width, img.height, dispW, dispH)
    }
    img.onerror = () => setError('Could not load image preview.')
    img.src = imageSrc
  }, [imageSrc, initCrop])

  function clampCrop(next: CropRect): CropRect {
    const minSize = 32
    const w = Math.max(minSize, Math.min(next.w, display.w))
    const h = Math.max(minSize, Math.min(next.h, display.h))
    const x = Math.max(0, Math.min(next.x, display.w - w))
    const y = Math.max(0, Math.min(next.y, display.h - h))
    return { x, y, w, h }
  }

  function onPointerDown(e: React.PointerEvent, mode: 'move' | 'resize') {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ mode, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (drag.mode === 'move') {
      setCrop(
        clampCrop({
          ...drag.startCrop,
          x: drag.startCrop.x + dx,
          y: drag.startCrop.y + dy,
        })
      )
    } else {
      setCrop(
        clampCrop({
          ...drag.startCrop,
          w: drag.startCrop.w + dx,
          h: drag.startCrop.h + dy,
        })
      )
    }
  }

  function handleUseOriginal() {
    onConfirm(file)
  }

  function handleConfirm() {
    if (!imageSrc || !natural.w || !display.w) return
    const scaleX = natural.w / display.w
    const scaleY = natural.h / display.h
    const sx = crop.x * scaleX
    const sy = crop.y * scaleY
    const sw = crop.w * scaleX
    const sh = crop.h * scaleY

    const maxEdge = Math.max(sw, sh)
    const outputScale = maxEdge > MAX_OUTPUT_EDGE ? MAX_OUTPUT_EDGE / maxEdge : 1
    const outW = Math.max(1, Math.round(sw * outputScale))
    const outH = Math.max(1, Math.round(sh * outputScale))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
      canvas.toBlob(
        (blob) => {
          if (!blob) return
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'company-logo'
          onConfirm(new File([blob], `${baseName}-logo.png`, { type: 'image/png' }))
        },
        'image/png',
        0.92
      )
    }
    img.src = imageSrc
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">Adjust organisation logo</h3>
        <p className="mt-1 text-sm text-slate-500">
          Optionally drag the frame to crop unwanted areas. Any shape is fine — use the full image or trim edges as you
          prefer.
        </p>

        {loading && (
          <div className="mt-6 flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {!loading && imageSrc && display.w > 0 && (
          <div
            className="relative mx-auto mt-5 overflow-hidden rounded-xl bg-slate-900"
            style={{ width: display.w, height: display.h }}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Logo preview"
              className="block h-full w-full object-contain"
              draggable={false}
            />
            <div
              className="absolute border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
            >
              <div
                className="absolute -bottom-2 -right-2 z-10 h-5 w-5 cursor-se-resize rounded-full border-2 border-white bg-blue-600"
                onPointerDown={(e) => onPointerDown(e, 'resize')}
              />
              <div
                className="absolute inset-0 z-0 cursor-move"
                onPointerDown={(e) => onPointerDown(e, 'move')}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUseOriginal}
            disabled={loading || !!error}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Use full image
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !!error || !imageSrc || display.w === 0}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Use cropped area
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
