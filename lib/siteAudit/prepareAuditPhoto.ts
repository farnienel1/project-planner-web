import { format } from 'date-fns'

/** Fit the capture stamp inside the photo. A 13px line overflows a small image. */
export function auditPhotoStampLayout(
  width: number,
  height: number,
  stamp: string
): { bar: number; fontSize: number; lines: string[] } {
  const pad = 8
  const maxText = Math.max(4, width - pad * 2)
  const datePart = stamp.split(',')[0]?.trim() || stamp
  const timePart = stamp.slice(datePart.length).replace(/^,\s*/, '').trim()
  const options = timePart ? [[stamp], [datePart, timePart]] : [[stamp]]
  for (const lines of options) {
    const longest = Math.max(...lines.map((line) => line.length), 1)
    const fitted = Math.floor(maxText / (longest * 0.62))
    const fontSize = Math.min(14, fitted)
    if (fontSize < 8) continue
    const bar = Math.min(height, Math.max(fontSize * lines.length + pad, 18))
    return { bar, fontSize, lines }
  }
  const lines = timePart ? [datePart, timePart] : [stamp]
  return { bar: Math.min(height, 18 * lines.length), fontSize: 8, lines }
}

/** iOS stamps each site-audit photo and keeps JPEGs within 1280px at quality 0.72. */
export async function prepareAuditPhoto(
  file: File,
  takenAt = new Date()
): Promise<{ file: File; takenAt: Date; previewUrl: string }> {
  const stamp = format(takenAt, 'd MMM yyyy, HH:mm')
  try {
    const bitmap = await createImageBitmap(file)
    const maxEdge = 1280
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return { file, takenAt, previewUrl: URL.createObjectURL(file) }
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const layout = auditPhotoStampLayout(width, height, stamp)
    context.fillStyle = 'rgba(8, 16, 32, 0.72)'
    context.fillRect(0, height - layout.bar, width, layout.bar)
    context.fillStyle = '#ffffff'
    context.font = `600 ${layout.fontSize}px sans-serif`
    layout.lines.forEach((line, index) => {
      const y = height - layout.bar + 4 + layout.fontSize * (index + 1)
      context.fillText(line, 8, y)
    })
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72))
    if (!blob) return { file, takenAt, previewUrl: URL.createObjectURL(file) }
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    const stamped = new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: takenAt.getTime() })
    return { file: stamped, takenAt, previewUrl: URL.createObjectURL(stamped) }
  } catch {
    return { file, takenAt, previewUrl: URL.createObjectURL(file) }
  }
}
