import { format } from 'date-fns'

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
    const bar = Math.max(28, Math.round(height * 0.055))
    context.fillStyle = 'rgba(8, 16, 32, 0.62)'
    context.fillRect(0, height - bar, width, bar)
    context.fillStyle = '#ffffff'
    context.font = `600 ${Math.max(13, Math.round(bar * 0.46))}px sans-serif`
    context.fillText(stamp, 12, height - Math.round(bar * 0.32))
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72))
    if (!blob) return { file, takenAt, previewUrl: URL.createObjectURL(file) }
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    const stamped = new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: takenAt.getTime() })
    return { file: stamped, takenAt, previewUrl: URL.createObjectURL(stamped) }
  } catch {
    return { file, takenAt, previewUrl: URL.createObjectURL(file) }
  }
}
