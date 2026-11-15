/**
 * Keeps only the answer of the latest request for a picker row (Data health "Link to a person…", review r319): open
 * row A, then row B before A's counts return — A's answer must not land as B's. `begin(key)` starts a request and
 * returns its token; `isCurrent(token)` is true only for the last request begun and only while it has not been
 * cleared (the picker closed or a link was saved).
 */
export type LatestRequest = {
  begin: (key: string) => { key: string; seq: number }
  isCurrent: (token: { key: string; seq: number }) => boolean
  clear: () => void
}

export function createLatestRequest(): LatestRequest {
  let seq = 0
  let current: { key: string; seq: number } | null = null
  return {
    begin(key) {
      seq += 1
      current = { key, seq }
      return current
    },
    isCurrent(token) {
      return current !== null && current.seq === token.seq && current.key === token.key
    },
    clear() {
      current = null
    },
  }
}
