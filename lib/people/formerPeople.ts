'use client'

/**
 * Rulebook 1.59.0 §11, §21 (owner decision 17 Nov): former people on old bookings. Web reads and writes
 * `organizations/{orgId}/deletedPeople` here; every rule (the record's shape, when one is needed, who it names,
 * "Former: Jane Smith") is the rulebook's (`lib/canonical/formerPeople.ts`).
 */

import { useEffect, useState } from 'react'
import { collection, getDocs, limit, query, where, type Firestore } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  DELETED_PEOPLE_COLLECTION,
  formerPersonRecordNeeded,
  parseFormerPersonDocument,
  type FormerPerson,
} from '@/lib/canonical/formerPeople'

/** The organisation's former-person records (staff read them; anyone else is refused and gets none). */
export async function loadFormerPeople(db: Firestore, organizationId: string): Promise<FormerPerson[]> {
  const org = organizationId.trim()
  if (!org) return []
  try {
    const snap = await getDocs(collection(db, 'organizations', org, DELETED_PEOPLE_COLLECTION))
    return snap.docs.map((row) => parseFormerPersonDocument(row.id, row.data())).filter((row): row is FormerPerson => row != null)
  } catch {
    return []
  }
}

/** Every case spelling of the ids (stored ids keep their case; queries compare exactly), at most 30 per query. */
function idChunks(ids: readonly string[]): string[][] {
  const all = Array.from(new Set(ids.flatMap((id) => [id, id.toUpperCase(), id.toLowerCase()]).filter(Boolean)))
  const chunks: string[][] = []
  for (let i = 0; i < all.length; i += 30) chunks.push(all.slice(i, i + 30))
  return chunks
}

async function anyUnder(db: Firestore, path: string[], field: string, ids: readonly string[]): Promise<number | null> {
  try {
    for (const chunk of idChunks(ids)) {
      const snap = await getDocs(query(collection(db, path[0], ...path.slice(1)), where(field, 'in', chunk), limit(1)))
      if (!snap.empty) return 1
    }
    return 0
  } catch {
    // Refused or failed: unknown, so the record is kept (`formerPersonRecordNeeded` reads null as "may have records").
    return null
  }
}

/**
 * Whether a delete should keep a former-person record (`formerPersonRecordNeeded`): `bookings` and
 * `managerSiteBookings` are what the delete already loaded (every date); leave (by `userId` — ids and emails — and by
 * `operativeId`), pay history and timesheets are `limit(1)` queries under the person's ids.
 */
export async function formerPersonNeededFor(
  db: Firestore,
  organizationId: string,
  ids: readonly string[],
  loaded: { bookings: number | null; managerSiteBookings: number | null },
  /** Rulebook 1.70.0: the person's email(s) — older iOS builds stored the account's email as a leave `userId` (§10). */
  emails: readonly string[] = []
): Promise<boolean> {
  if (loaded.bookings !== 0 || loaded.managerSiteBookings !== 0) return true
  const org = ['organizations', organizationId]
  const leaveUserIds = Array.from(new Set([...ids, ...emails.map((email) => email.trim()).filter(Boolean)]))
  // Rulebook 1.70.0 §11: leave counts under every key a record names a person by (`userId` — an id or the email — and
  // `operativeId`), so a person with only leave keeps their former-person record and their leave is not unlinked.
  const [leaveByUser, leaveByOperative, payHistoryRows, timesheets] = await Promise.all([
    anyUnder(db, [...org, 'holidayBookings'], 'userId', leaveUserIds),
    anyUnder(db, [...org, 'holidayBookings'], 'operativeId', ids),
    anyUnder(db, [...org, 'operativeDayRateHistory'], 'userId', ids),
    anyUnder(db, [...org, 'settings'], 'userId', ids),
  ])
  const leaveRecords =
    (leaveByUser ?? 0) > 0 || (leaveByOperative ?? 0) > 0 ? 1 : leaveByUser == null || leaveByOperative == null ? null : 0
  return formerPersonRecordNeeded({ bookings: 0, managerSiteBookings: 0, leaveRecords, payHistoryRows, timesheets })
}

/** True for a Firestore permission refusal. */
export function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'permission-denied' || String((error as { message?: unknown } | null)?.message ?? '').includes('PERMISSION_DENIED')
}

/**
 * The organisation's former-person records for a screen (read once when it opens: written once and never changed,
 * `LIVE_COLLECTIONS` `deletedPeople`). Only staff read them; pass `enabled` false for anyone else (the rules refuse
 * them, and the screen simply shows "Unknown person" as before).
 */
export function useFormerPeople(organizationId: string | null | undefined, enabled = true): FormerPerson[] {
  const [rows, setRows] = useState<FormerPerson[]>([])
  useEffect(() => {
    const org = (organizationId || '').trim()
    if (!org || !enabled) {
      setRows([])
      return
    }
    let live = true
    void loadFormerPeople(getFirebaseDb(), org).then((next) => {
      if (live) setRows(next)
    })
    return () => {
      live = false
    }
  }, [organizationId, enabled])
  return rows
}
