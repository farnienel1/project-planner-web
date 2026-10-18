'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const OUTPUT = 512

type Crop = { x: number; y: number; size: number }

export function ProfilePhotoCropModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File
  onCancel: () => void
  onConfirm: (croppedFile: File) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [display, setDisplay] = useState({ w: 0, h: 0 })
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, size: 120 })
  const [drag, setDrag] = useState<{ startX: number; startY: number; start: Crop } | null>(null)

  useEffect(() => {
    setMounted(true)
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const init = useCallback((imgW: number, imgH: number, dispW: number, dispH: number) => {
    const size = Math.min(dispW, dispH) * 0.78
    setCrop({ x: (dispW - size) / 2, y: (dispH - size) / 2, size })
    setNatural({ w: imgW, h: imgH })
    setDisplay({ w: dispW, h: dispH })
  }, [])

  const onImage = (image: HTMLImageElement) => {
    const maxW = Math.min(360, window.innerWidth - 48)
    const scale = Math.min(maxW / image.naturalWidth, 360 / image.naturalHeight, 1)
    init(image.naturalWidth, image.naturalHeight, image.naturalWidth * scale, image.naturalHeight * scale)
  }

  useEffect(() => {
    if (!drag) return
    const move = (event: PointerEvent) => {
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      const size = drag.start.size
      setCrop({
        x: Math.min(Math.max(0, drag.start.x + dx), Math.max(0, display.w - size)),
        y: Math.min(Math.max(0, drag.start.y + dy), Math.max(0, display.h - size)),
        size,
      })
    }
    const up = () => setDrag(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [drag, display.h, display.w])

  const confirm = async () => {
    if (!src || !natural.w) return
    const image = new Image()
    image.src = src
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('Could not read that photo.'))
    })
    const scaleX = natural.w / display.w
    const scaleY = natural.h / display.h
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('Could not crop that photo.')
      return
    }
    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.size * scaleX,
      crop.size * scaleY,
      0,
      0,
      OUTPUT,
      OUTPUT
    )
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    if (!blob) {
      setError('Could not crop that photo.')
      return
    }
    onConfirm(new File([blob], 'profile.jpg', { type: 'image/jpeg' }))
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-extrabold text-slate-900">Choose the visible area</h2>
        <p className="mt-1 text-sm text-slate-600">
          Drag the circle to pick what shows on the round profile photo.
        </p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="relative mt-4 overflow-hidden rounded-2xl bg-slate-100">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              onLoad={(event) => onImage(event.currentTarget)}
              style={{ width: display.w || '100%', height: display.h || 'auto' }}
              className="block max-w-full select-none"
              draggable={false}
            />
          ) : null}
          {display.w > 0 ? (
            <button
              type="button"
              aria-label="Move crop"
              className="absolute cursor-move rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
              style={{ left: crop.x, top: crop.y, width: crop.size, height: crop.size }}
              onPointerDown={(event) => {
                event.preventDefault()
                setDrag({ startX: event.clientX, startY: event.clientY, start: crop })
              }}
            />
          ) : null}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white"
            onClick={() => void confirm().catch((err) => setError(err instanceof Error ? err.message : 'Could not crop that photo.'))}
          >
            Use this crop
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
