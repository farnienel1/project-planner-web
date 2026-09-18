/** Rejects if `promise` does not settle within `ms`. The original work keeps running. */
export class TimeoutError extends Error {
  readonly timedOut = true as const

  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true
  if (error instanceof Error && error.name === 'TimeoutError') return true
  return Boolean(
    error &&
      typeof error === 'object' &&
      'timedOut' in error &&
      (error as { timedOut?: unknown }).timedOut === true
  )
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/** Resolve `promise` if it finishes in time; otherwise return `fallback` and keep going. */
export async function withTimeoutFallback<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  try {
    return await withTimeout(promise, ms, 'timeout')
  } catch {
    return fallback
  }
}
