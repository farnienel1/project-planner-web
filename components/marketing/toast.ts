export function mktToast(message: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('mkt-toast', { detail: message }))
}
