const RELOAD_FLAG = 'pp-stale-chunk-reload'

function errorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

export function isChunkLoadError(error: unknown): boolean {
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: string }).name ?? '')
      : ''
  const message = errorText(error)
  return (
    name === 'ChunkLoadError' ||
    /Failed to load chunk/i.test(message) ||
    /Loading chunk [\w.-]+ failed/i.test(message) ||
    /\/_next\/static\/chunks\//i.test(message)
  )
}

/** After a deploy, old hashed chunks 404. Load a cache-busted URL once. */
export function reloadOnceOnStaleChunk(error: unknown): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) return false
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    // continue to reload even if storage is blocked
  }
  const next = new URL(window.location.href)
  next.searchParams.set('_reload', Date.now().toString())
  window.location.replace(next.toString())
  return true
}

export function clearStaleChunkReloadFlag(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    // ignore
  }
}
