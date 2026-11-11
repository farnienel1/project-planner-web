/**
 * The pure part of the roster's unfolded document list (`useOrgUserStore.rosterDocuments`, rulebook 1.30.3 §11):
 * every users document of the organisation by id. No Firebase import, so the data-parity fixture (rulebook 1.38.0
 * §27) runs this exact code in tests.
 */
import type { User } from '@/types'

/**
 * `rows` laid over `current` by id. A live listener snapshot only adds and updates (a document leaving the
 * `organizationId` query does not prove the person left; the full load decides). A complete full load replaces
 * the list (`replace`).
 */
export function rosterDocumentsAfter(current: readonly User[], rows: readonly User[], replace = false): User[] {
  const byId = new Map((replace ? [] : current).map((row) => [row.id, row]))
  for (const row of rows) byId.set(row.id, row)
  return [...byId.values()]
}
