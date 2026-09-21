'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Great_Vibes } from 'next/font/google'
import { signaturePngSrc, stripPngDataUrl } from '@/lib/signature/signatureImage'

const signatureFont = Great_Vibes({
  subsets: ['latin'],
  weight: '400',
})

type Point = { x: number; y: number }

export function SignaturePad({
  value: _existingPng,
  onChange,
  disabled,
  className,
}: {
  value?: string | null
  onChange: (base64Png: string | null) => void
  disabled?: boolean
  className?: string
}) {
  void _existingPng
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const strokesRef = useRef<Point[][]>([])
  const nameRef = useRef('')
  const [typedName, setTypedName] = useState('')
  const [fontReady, setFontReady] = useState(false)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 148
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const name = nameRef.current.trim()
    if (name) {
      const family = signatureFont.style.fontFamily || 'cursive'
      let size = Math.min(54, Math.max(28, height * 0.42))
      ctx.fillStyle = '#111827'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.font = `${size}px ${family}`
      const maxWidth = width - 32
      while (size > 22 && ctx.measureText(name).width > maxWidth) {
        size -= 2
        ctx.font = `${size}px ${family}`
      }
      ctx.fillText(name, width / 2, height * 0.46)
    }

    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i += 1) ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
    }
  }, [])

  const exportPng = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const hasInk = nameRef.current.trim().length > 0 || strokesRef.current.some((stroke) => stroke.length > 1)
    if (!hasInk) {
      onChange(null)
      return
    }
    onChange(stripPngDataUrl(canvas.toDataURL('image/png')))
  }, [onChange])

  const redrawAndExport = useCallback(() => {
    paint()
    exportPng()
  }, [exportPng, paint])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        await document.fonts.load(`400 48px ${signatureFont.style.fontFamily}`)
        await document.fonts.ready
      } catch {
        // Canvas still draws with the fallback stack.
      }
      if (!cancelled) setFontReady(true)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    paint()
  }, [fontReady, paint])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => paint())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [paint])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const clear = () => {
    nameRef.current = ''
    strokesRef.current = []
    setTypedName('')
    paint()
    onChange(null)
  }

  return (
    <div className={className || 'space-y-2'}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ios-muted">Signature</p>
        <button type="button" onClick={clear} disabled={disabled} className="text-[12px] font-semibold text-[#185FA5]">
          Clear
        </button>
      </div>
      <input
        type="text"
        value={typedName}
        disabled={disabled}
        autoComplete="name"
        placeholder="Type your name"
        aria-label="Type your name"
        onChange={(event) => {
          const next = event.target.value
          nameRef.current = next
          setTypedName(next)
          requestAnimationFrame(() => redrawAndExport())
        }}
        className={`w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-[22px] text-slate-900 outline-none placeholder:text-[15px] placeholder:font-sans placeholder:text-slate-400 focus:border-[#185FA5] ${signatureFont.className}`}
      />
      <canvas
        ref={canvasRef}
        className="h-[148px] w-full touch-none rounded-[10px] border border-dashed border-slate-300 bg-white"
        onPointerDown={(event) => {
          if (disabled) return
          drawing.current = true
          strokesRef.current = [...strokesRef.current, [point(event)]]
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drawing.current || disabled) return
          const strokes = strokesRef.current
          const current = strokes[strokes.length - 1]
          if (!current) return
          current.push(point(event))
          paint()
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          exportPng()
        }}
        onPointerCancel={() => {
          drawing.current = false
        }}
      />
      <p className="text-[13px] text-ios-muted">
        Type your name to fill the box in handwriting, or draw. You can do both.
      </p>
    </div>
  )
}

export function SignatureImage({
  base64,
  alt = 'Signature',
  className,
}: {
  base64?: string | null
  alt?: string
  className?: string
}) {
  const src = signaturePngSrc(base64)
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  )
}
