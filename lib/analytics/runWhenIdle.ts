/**
 * Analytics writes are not part of the page. Let the page's own reads go first,
 * then write when the browser is idle (or after a short cap).
 */
export function runWhenIdle(task: () => void, capMs = 1_500): () => void {
  if (typeof window === 'undefined') {
    task()
    return () => undefined
  }
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  if (typeof idle === 'function') {
    const handle = idle(task, { timeout: capMs })
    return () => (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle)
  }
  const handle = window.setTimeout(task, Math.min(capMs, 400))
  return () => window.clearTimeout(handle)
}
