'use client'

import { useEffect, useRef } from 'react'

export function SignaturePad({
  value,
  onChange,
  disabled,
}: {
  value?: string | null
  onChange: (base64Png: string | null) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 140
    canvas.width = width * ratio
    canvas.height = height * ratio
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    if (value) {
      const image = new Image()
      image.onload = () => ctx.drawImage(image, 0, 0, width, height)
      image.src = `data:image/png;base64,${value}`
    }
  }, [value])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const exportPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    onChange(base64)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ios-muted">Signature</p>
        <button type="button" onClick={clear} disabled={disabled} className="text-[12px] font-semibold text-[#185FA5]">
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="h-[140px] w-full touch-none rounded-[10px] border border-dashed border-slate-300 bg-white"
        onPointerDown={(event) => {
          if (disabled) return
          drawing.current = true
          const ctx = canvasRef.current?.getContext('2d')
          if (!ctx) return
          const { x, y } = point(event)
          ctx.beginPath()
          ctx.moveTo(x, y)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drawing.current || disabled) return
          const ctx = canvasRef.current?.getContext('2d')
          if (!ctx) return
          const { x, y } = point(event)
          ctx.lineTo(x, y)
          ctx.stroke()
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          exportPng()
        }}
      />
      <p className="text-[13px] text-ios-muted">Sign above · tap to clear</p>
    </div>
  )
}
