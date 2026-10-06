/** iOS stores completion file URLs as strings. Older web rows used `{ name, url }`. */

export function completionFileUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const urls: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string') {
      const url = entry.trim()
      if (url) urls.push(url)
      continue
    }
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>
      const url = typeof record.url === 'string' ? record.url : typeof record.fileURL === 'string' ? record.fileURL : ''
      if (url.trim()) urls.push(url.trim())
    }
  }
  return urls
}

export function completionFileLabel(url: string): string {
  const path = url.split('?')[0] || url
  try {
    const name = decodeURIComponent(path.split('/').pop() || '')
    return name || url
  } catch {
    return path.split('/').pop() || url
  }
}
