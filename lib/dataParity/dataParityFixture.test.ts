/**
 * Rulebook 1.38.0 §27 (owner decision 11 Nov) — the two-app comparison, web half. The shared fixture
 * `lib/canonical/data-parity-fixture.json` (mirrored to iOS as `ProjectPlannerTests/DataParityFixture.json`) holds
 * raw Firestore documents of a test company and a sequence of listener events. Each event is fed through the web
 * app's real merge code — the organisation listener (`mergeOrgCollectionSnapshot`), the projects / small works store
 * (`jobsFromListenerDocs`), the bookings store (`bookingsFromListenerDocs`) and the roster's document list
 * (`rosterDocumentsAfter`, with the full reload a removal triggers) — and after every step the held lists must be
 * exactly `expectedHeld`, the rulebook's visible job lists `expectedVisible`, and `dataParityCheck` against the
 * database `expectedParityMismatches`. A release that drops or keeps a record wrongly fails here. Test data only.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fixture from '@/lib/canonical/data-parity-fixture.json'
import { dataParityCheck, isLegacyPlaceholderDocumentId, worksListMembership } from '@/lib/canonical'
import { mergeOrgCollectionSnapshot, readerDroppedJobDocuments, type OrgCollectionDoc } from '@/lib/firebase/orgCollectionMerge'
import { jobsFromListenerDocs } from '@/lib/stores/jobListMerge'
import { bookingsFromListenerDocs } from '@/lib/stores/bookingListMerge'
import { rosterDocumentsAfter } from '@/lib/staff/rosterDocuments'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import type { Booking, Project, User } from '@/types'

type Step = {
  id: string
  description: string
  writes: Array<{ op: 'set' | 'delete'; list: string; id: string; data?: Record<string, unknown> }>
  events: Array<{ list: 'projects' | 'smallWorks' | 'users' | 'bookings'; source: 'server' | 'cache' | 'refused'; ids?: string[] }>
  expectedHeld: Record<string, string[]>
  expectedVisible: Record<string, string[]>
  expectedParityMismatches: string[]
}

const ids = (rows: ReadonlyArray<{ id: string }>) => rows.map((row) => row.id.toLowerCase()).sort()
const lower = (list: readonly string[]) => list.map((id) => id.toLowerCase()).sort()

test('1.38.0 data-parity fixture: the web stores hold exactly the database after every listener event', () => {
  const org = fixture.organizationId
  const db: Record<string, OrgCollectionDoc[]> = JSON.parse(JSON.stringify(fixture.initialDatabase))
  const listenerDocs: Record<string, OrgCollectionDoc[]> = { projects: [], smallWorks: [], bookings: [] }
  let projects: Project[] = []
  let smallWorks: Project[] = []
  let bookings: Booking[] = []
  let rosterDocs: User[] = []
  let rosterSeen = new Map<string, string>()
  const parseUsers = (rows: readonly OrgCollectionDoc[]) =>
    rows.map((row) => parseOrgUser(row.id, row.data)).filter((user): user is User => user !== null)

  for (const step of fixture.steps as unknown as Step[]) {
    for (const write of step.writes) {
      db[write.list] = db[write.list].filter((row) => row.id !== write.id)
      if (write.op === 'set') db[write.list].push({ id: write.id, data: write.data as Record<string, unknown> })
    }
    for (const event of step.events) {
      if (event.source === 'refused') continue // the listener stops; the app keeps what it holds
      const fromCache = event.source === 'cache'
      const snapshot = fromCache
        ? db[event.list].filter((row) => (event.ids ?? []).includes(row.id))
        : db[event.list]
      if (event.list === 'users') {
        // The roster listener reports document changes; a server snapshot that drops a document triggers the full
        // reload (complete), which replaces the document list.
        const changed = snapshot.filter((row) => rosterSeen.get(row.id) !== JSON.stringify(row.data))
        const removed = [...rosterSeen.keys()].some((id) => !snapshot.some((row) => row.id === id))
        if (!fromCache || snapshot.length > 0) {
          rosterSeen = new Map(snapshot.map((row) => [row.id, JSON.stringify(row.data)]))
        }
        rosterDocs = rosterDocumentsAfter(rosterDocs, parseUsers(changed))
        if (removed && !fromCache) rosterDocs = rosterDocumentsAfter(rosterDocs, parseUsers(db.users), true)
        continue
      }
      const merged = mergeOrgCollectionSnapshot({ previous: listenerDocs[event.list], docs: snapshot, fromCache })
      listenerDocs[event.list] = merged.docs
      const meta = { authoritative: merged.authoritative }
      if (event.list === 'projects') projects = jobsFromListenerDocs({ organizationId: org, kind: 'projects', docs: merged.docs, meta, previous: projects, planMode: false })
      if (event.list === 'smallWorks') smallWorks = jobsFromListenerDocs({ organizationId: org, kind: 'smallWorks', docs: merged.docs, meta, previous: smallWorks, planMode: false })
      if (event.list === 'bookings') bookings = bookingsFromListenerDocs({ organizationId: org, docs: merged.docs, previous: bookings })
    }
    const held: Record<string, string[]> = {
      projects: ids(projects),
      smallWorks: ids(smallWorks),
      users: ids(rosterDocs),
      bookings: ids(bookings),
    }
    for (const list of fixture.lists) {
      assert.deepEqual(held[list], lower(step.expectedHeld[list]), `${step.id}: ${list} (${step.description})`)
    }
    assert.deepEqual(ids(worksListMembership(projects, 'projects')), lower(step.expectedVisible.projects), `${step.id}: visible projects`)
    assert.deepEqual(ids(worksListMembership(smallWorks, 'smallWorks')), lower(step.expectedVisible.smallWorks), `${step.id}: visible small works`)
    const result = dataParityCheck({
      lists: fixture.lists.map((key) => ({
        key,
        serverCount: db[key].length,
        localIds: held[key],
        readerDroppedCount: key === 'projects' || key === 'smallWorks'
          ? readerDroppedJobDocuments(listenerDocs[key], isLegacyPlaceholderDocumentId)
          : 0,
      })),
    })
    assert.deepEqual(result.reloadKeys, step.expectedParityMismatches, `${step.id}: data check`)
  }
})

test('1.38.0: a cache snapshot never drops a held row; a server snapshot does', () => {
  const a = { id: 'a', data: {} }
  const b = { id: 'b', data: {} }
  assert.deepEqual(mergeOrgCollectionSnapshot({ previous: [a, b], docs: [b], fromCache: true }).docs.map((d) => d.id), ['a', 'b'])
  assert.deepEqual(mergeOrgCollectionSnapshot({ previous: [a, b], docs: [b], fromCache: false }).docs.map((d) => d.id), ['b'])
  assert.deepEqual(mergeOrgCollectionSnapshot({ previous: [a, b], docs: [], fromCache: true }).docs.map((d) => d.id), ['a', 'b'])
  assert.deepEqual(mergeOrgCollectionSnapshot({ previous: [a, b], docs: [b], removedIds: new Set(['a']), fromCache: true }).docs.map((d) => d.id), ['b'])
})
