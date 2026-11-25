'use client'

/**
 * Rulebook 1.91.0 §34 (owner report 25 Nov): Settings → Data health "List rows with no person" — `managers` and
 * `operatives` rows whose person has no users document any more (a row left behind by an older delete) or whose every
 * account is an anonymised deleted profile (`taskAssigneeCandidates().leftovers`). They are never offered in the task
 * pickers; a task already assigned to one reads "Removed user". Admin only. Read only: never writes.
 */

import { useEffect, useMemo } from 'react'
import { taskAssigneeCandidates } from '@/lib/canonical'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'

const REASON_TEXT = {
  noAccount: 'no app account names this person',
  deletedAccount: 'their account was deleted',
} as const

export function CatalogueRowsWithoutPerson({ organizationId }: { organizationId: string }) {
  const { operatives, managers, allManagerRows, loadOperatives, loadManagers, operativesLoadedOrgId, managersLoadedOrgId } =
    useOperativeStore()
  const { loadUsers, rosterServerOrgId } = useOrgUserStore()
  const roster = useRosterDocuments(organizationId)

  useEffect(() => {
    void loadOperatives(organizationId)
    void loadManagers(organizationId)
    void loadUsers(organizationId)
  }, [organizationId, loadOperatives, loadManagers, loadUsers])

  const loaded = operativesLoadedOrgId === organizationId && managersLoadedOrgId === organizationId && rosterServerOrgId === organizationId
  const rows = useMemo(
    () =>
      taskAssigneeCandidates({ managers: allManagerRows.length > 0 ? allManagerRows : managers, operatives, roster: roster as never })
        .leftovers,
    [allManagerRows, managers, operatives, roster]
  )

  // Review of #458 (finding 4): an Operatives row with no account is usually a real no-login operative not converted
  // to a ghost yet, not something left behind by a delete, so it is listed apart with its own wording.
  const leftBehind = rows.filter((row) => !(row.kind === 'operative' && row.reason === 'noAccount'))
  const noLogin = rows.filter((row) => row.kind === 'operative' && row.reason === 'noAccount')

  if (!loaded) return null

  const item = (row: (typeof rows)[number], reason: string) => (
    <li key={`${row.kind}:${row.id}`} className="text-sm">
      <span className="font-semibold">{row.name}</span>
      <span className="text-(--ink3)">
        {' '}
        — {row.kind === 'manager' ? 'Managers list' : 'Operatives list'}
        {row.email ? ` · ${row.email}` : ''} · {reason}
        {row.active ? '' : ' · inactive'}
      </span>
    </li>
  )

  return (
    <section className="card p-4" aria-label="List rows with no person">
      <h2 className="text-[15px] font-bold">Managers and Operatives list rows with no person</h2>
      <p className="mt-1 text-sm text-(--ink3)">
        Rows left behind on the Managers or Operatives list after a person was deleted, or whose account was deleted. They are not offered when
        assigning tasks; a task already assigned to one shows &ldquo;Removed user&rdquo; so it can be reassigned.
      </p>
      {leftBehind.length === 0 ? (
        <p className="mt-2 text-sm text-(--ink3)">No list rows without a person.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">{leftBehind.map((row) => item(row, REASON_TEXT[row.reason]))}</ul>
      )}
      {noLogin.length > 0 ? (
        <>
          <h3 className="mt-4 text-[14px] font-bold">Operatives with no app account</h3>
          <p className="mt-1 text-sm text-(--ink3)">
            Operatives list rows with no app account (not converted to a ghost). These are often real people who work
            without the app — check before removing any. They are not offered when assigning tasks.
          </p>
          <ul className="mt-2 space-y-1.5">{noLogin.map((row) => item(row, 'no app account (not converted to a ghost)'))}</ul>
        </>
      ) : null}
    </section>
  )
}
