const g = window
g.__NAV__ = g.__NAV__ || []
const router = {
  push: (h) => g.__NAV__.push({ op: 'push', href: String(h) }),
  replace: (h) => g.__NAV__.push({ op: 'replace', href: String(h) }),
  back: () => g.__NAV__.push({ op: 'back' }),
  forward: () => {},
  refresh: () => {},
  prefetch: () => Promise.resolve(),
}
export function useRouter() {
  return router
}
export function usePathname() {
  return g.__PATHNAME__ || '/dashboard/users/x'
}
export function useSearchParams() {
  return new URLSearchParams('from=users')
}
export function useParams() {
  return {}
}
export function redirect() {}
export function notFound() {}
export function useSelectedLayoutSegment() {
  return null
}
