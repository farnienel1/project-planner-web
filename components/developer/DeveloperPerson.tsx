'use client'

import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { useOwnerFreshAction } from '@/components/developer/OwnerReverify'
import { ownerGet } from '@/lib/owner/client/ownerApi'
import {
  ownerChangeUserEmail,
  ownerChangeUserName,
  ownerDeleteUnfinishedUser,
  ownerPreviewChangeEmail,
  ownerRevealEmail,
  ownerRevokeSessions,
  ownerSendPasswordReset,
  type ChangeEmailPreview,
  type NameChangeSummary,
  type RevokeSummary,
} from '@/lib/owner/ownerActions'
import { OWNER_REASON_MAX, OWNER_REASON_MIN, ownerReasonError } from '@/lib/owner/personActions'
import type { OwnerPersonRow } from '@/lib/owner/directory'
import type { OwnerPersonAuditRow, OwnerPersonAuth, OwnerPersonDocument, OwnerPersonOrganisation } from '@/lib/owner/person360'

export type OwnerPersonResponse = {
  person: OwnerPersonRow
  documents: OwnerPersonDocument[]
  personIds: string[]
  organisations: OwnerPersonOrganisation[]
  membershipsRead: boolean
  auth: OwnerPersonAuth[] | null
  serverKey: boolean
  serverKeyError: string | null
  audit: OwnerPersonAuditRow[]
  auditTruncated: boolean
  auditError: string | null
  isPlatformOwner: boolean
  truncated: boolean
}

const LEVEL_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', operative: 'Operative' }
const SEGMENT_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive', pending: 'Pending' }
const SOURCE_LABEL: Record<string, string> = {
  users: 'their user record here',
  membership: 'their membership',
  members: 'the company’s member list',
  creator: 'they created it',
}
const PHASE_LABEL: Record<string, string> = { requested: 'started, not finished', completed: 'done', failed: 'failed' }

function when(ms: number | null | undefined, empty = 'Never'): string {
  if (!ms) return empty
  return new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: LONDON_TIME_ZONE })
}

type ActionKind = 'reset' | 'name' | 'email' | 'revoke' | 'delete'

export function DeveloperPersonScreen({ uid }: { uid: string }) {
  const [data, setData] = useState<OwnerPersonResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [emails, setEmails] = useState<string[] | null>(null)
  const [action, setAction] = useState<ActionKind | null>(null)
  const { run, dialog } = useOwnerFreshAction()

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true)
      try {
        setData(await ownerGet<OwnerPersonResponse>(`/api/owner/people/${encodeURIComponent(uid)}`, { refresh }))
        setError('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load this person.')
      } finally {
        setLoading(false)
      }
    },
    [uid]
  )
  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data && !error) return <LoadingSpinner label="Loading person…" />
  if (!data) {
    return (
      <DeveloperShell title="Person" back={{ href: '/developer/users', label: 'People' }}>
        <EmptyState title="Person not found" description={error || 'They may have been removed.'} />
      </DeveloperShell>
    )
  }

  const { person } = data
  const done = (message: string) => {
    setAction(null)
    setNotice(message)
    void load(true)
  }
  const locked = data.isPlatformOwner

  return (
    <DeveloperShell
      title={person.name}
      back={{ href: '/developer/users', label: 'People' }}
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void load(true)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="person-summary">
        <span className="chip">{SEGMENT_LABEL[person.segment] || person.segment}</span>
        <span className="chip">{person.role}</span>
        {person.ghost ? <span className="chip">No app login</span> : null}
        {person.isTest ? <span className="chip">Test</span> : null}
        <span className="text-(--ink2)">
          {emails ? emails.join(', ') : person.emailMasked || 'No email'}
        </span>
        {!emails && person.emailMasked ? (
          <button
            type="button"
            className="btn sm ghost"
            onClick={async () => {
              try {
                setEmails(await ownerRevealEmail(uid))
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not reveal the email.')
              }
            }}
          >
            Reveal email (logged)
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="banner" data-hue="red" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="banner" data-hue="green" role="status">
          {notice}
        </p>
      ) : null}

      <Section title="Actions">
        {locked ? (
          <p className="text-sm text-(--ink3)">This is the owner account: it is not changed from this console.</p>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="person-actions">
            <button type="button" className="btn sm" onClick={() => setAction('reset')}>
              Send password reset
            </button>
            <button type="button" className="btn sm" onClick={() => setAction('name')}>
              Change name
            </button>
            <button type="button" className="btn sm" onClick={() => setAction('email')}>
              Change login email
            </button>
            <button type="button" className="btn sm" onClick={() => setAction('revoke')}>
              Sign out everywhere
            </button>
            {person.segment === 'pending' ? (
              <button type="button" className="btn sm danger" onClick={() => setAction('delete')}>
                Delete unfinished sign-up
              </button>
            ) : null}
          </div>
        )}
        {!data.serverKey ? (
          <p className="mt-2 text-xs text-(--ink3)">
            Changing a login email, signing someone out and deleting an unfinished sign-up need the server key
            (FIREBASE_SERVICE_ACCOUNT_JSON) on Netlify. Until it is set they say so and change nothing.
          </p>
        ) : null}
      </Section>

      <Section title="Organisations">
        {data.organisations.length === 0 ? (
          <p className="text-sm text-(--ink3)">Not in any organisation.</p>
        ) : (
          <ul className="space-y-2" data-testid="person-organisations">
            {data.organisations.map((org) => (
              <li key={org.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/developer/organisations/${encodeURIComponent(org.id)}`} className="font-semibold">
                  {org.name}
                </Link>
                <span className="chip">
                  {LEVEL_LABEL[org.level] || org.level}
                  {org.isSuperAdmin ? ' · Super Admin' : ''}
                </span>
                <span className="text-xs text-(--ink3)">from {SOURCE_LABEL[org.source] || org.source}</span>
                {org.deletion === 'scheduled' ? <span className="chip">Scheduled for deletion</span> : null}
                {org.lapsed ? <span className="chip">Subscription lapsed</span> : null}
                {org.isTest ? <span className="chip">Test</span> : null}
              </li>
            ))}
          </ul>
        )}
        {data.serverKey && !data.membershipsRead ? (
          <p className="mt-2 text-xs text-(--ink3)">Memberships in other companies could not be read just now.</p>
        ) : null}
      </Section>

      <Section title="Sign-in">
        {data.auth === null ? (
          <p className="text-sm text-(--ink3)">Not connected. {data.serverKeyError}</p>
        ) : data.auth.length === 0 ? (
          <p className="text-sm text-(--ink3)">No sign-in account (an invite not accepted yet, or a ghost operative).</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2" data-testid="person-auth">
            {data.auth.map((account) => (
              <AuthFacts key={account.uid} account={account} />
            ))}
          </dl>
        )}
      </Section>

      <Section title={`Records (${data.documents.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="text-xs uppercase text-(--ink3)">
              <tr>
                <th className="py-1 pr-4">User id</th>
                <th className="py-1 pr-4">Organisation</th>
                <th className="py-1 pr-4">Status</th>
                <th className="py-1 pr-4">Last seen</th>
                <th className="py-1 pr-4">App</th>
                <th className="py-1 pr-4">Devices</th>
                <th className="py-1 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.documents.map((doc) => (
                <tr key={doc.id} className="border-t border-(--line)">
                  <td className="py-2 pr-4 font-mono text-xs">{doc.id}</td>
                  <td className="py-2 pr-4">
                    {data.organisations.find((org) => org.id === doc.organizationId)?.name || doc.organizationId || '—'}
                  </td>
                  <td className="py-2 pr-4">{SEGMENT_LABEL[doc.segment] || doc.segment}</td>
                  <td className="py-2 pr-4">{when(doc.lastSeenAtMs)}</td>
                  <td className="py-2 pr-4">
                    {doc.lastSeenFrom ? `${doc.lastSeenFrom}${doc.lastSeenAppVersion ? ` ${doc.lastSeenAppVersion}` : ''}` : 'Not recorded'}
                  </td>
                  <td className="py-2 pr-4">{doc.pushTokenCount}</td>
                  <td className="py-2 pr-4">{when(doc.createdAtMs, '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.personIds.length > data.documents.length ? (
          <p className="mt-2 text-xs text-(--ink3)">Also goes by: {data.personIds.filter((id) => !data.documents.some((doc) => doc.id === id)).join(', ')}</p>
        ) : null}
      </Section>

      <Section title="Owner actions about this person">
        {data.auditError ? <p className="text-sm text-(--ink3)">{data.auditError}</p> : null}
        {data.audit.length === 0 && !data.auditError ? <p className="text-sm text-(--ink3)">None yet.</p> : null}
        <ul className="space-y-1 text-sm" data-testid="person-audit">
          {data.audit.map((row) => (
            <li key={`${row.requestId}-${row.atMs}-${row.action}`}>
              <b>{row.label}</b> · {PHASE_LABEL[row.phase] || row.phase} · {when(row.atMs)}
              {row.reason ? <span className="text-(--ink3)"> · “{row.reason}”</span> : null}
            </li>
          ))}
        </ul>
        {data.auditTruncated ? <p className="mt-1 text-xs text-(--ink3)">Showing the first entries read; the Audit log page lists all.</p> : null}
      </Section>

      {action === 'reset' ? (
        <ResetDialog uid={uid} name={person.name} onClose={() => setAction(null)} onDone={done} run={run} />
      ) : null}
      {action === 'name' ? (
        <NameDialog uid={uid} person={person} documents={data.documents} onClose={() => setAction(null)} onDone={done} run={run} />
      ) : null}
      {action === 'email' ? <EmailDialog uid={uid} name={person.name} onClose={() => setAction(null)} onDone={done} run={run} /> : null}
      {action === 'revoke' ? <RevokeDialog uid={uid} name={person.name} onClose={() => setAction(null)} onDone={done} run={run} /> : null}
      {action === 'delete' ? (
        <DeleteDialog uid={uid} name={person.name} onClose={() => setAction(null)} onDone={(message) => {
          setAction(null)
          setNotice(message)
        }} run={run} />
      ) : null}
      {dialog}
    </DeveloperShell>
  )
}

function AuthFacts({ account }: { account: OwnerPersonAuth }) {
  return (
    <>
      <dt className="text-(--ink3)">Login</dt>
      <dd>
        {account.emailMasked || '—'} {account.emailVerified ? '· verified' : '· not verified'}
        {account.disabled ? ' · sign-in disabled' : ''}
      </dd>
      <dt className="text-(--ink3)">Signs in with</dt>
      <dd>{account.providers.length ? account.providers.join(', ') : '—'}</dd>
      <dt className="text-(--ink3)">Created</dt>
      <dd>{when(account.createdAtMs, '—')}</dd>
      <dt className="text-(--ink3)">Last sign-in</dt>
      <dd>{when(account.lastLoginAtMs)}</dd>
      <dt className="text-(--ink3)">Last token refresh</dt>
      <dd>{when(account.lastRefreshAtMs)}</dd>
      <dt className="text-(--ink3)">Signed out everywhere</dt>
      <dd>{when(account.validSinceMs, '—')}</dd>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card pad space-y-2">
      <h2 className="h2">{title}</h2>
      {children}
    </section>
  )
}

type Run = <T>(action: () => Promise<T>) => Promise<T>
type DialogProps = { uid: string; name: string; onClose: () => void; onDone: (message: string) => void; run: Run }

function ActionDialog({
  title,
  consequence,
  children,
  reason,
  setReason,
  confirmLabel,
  canConfirm,
  onConfirm,
  onClose,
  danger,
}: {
  title: string
  consequence: ReactNode
  children?: ReactNode
  reason: string
  setReason: (value: string) => void
  confirmLabel: string
  canConfirm: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
  danger?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reasonError = ownerReasonError(reason)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="person-action-title">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-(--card) p-5 shadow-xl">
        <h2 id="person-action-title" className="text-lg font-extrabold">
          {title}
        </h2>
        <div className="mt-2 text-sm text-(--ink2)">{consequence}</div>
        {children}
        <label className="f mt-3 block text-sm font-semibold">
          Reason (kept in the audit log, {OWNER_REASON_MIN}–{OWNER_REASON_MAX} characters)
          <input className="pp-in mt-1" value={reason} maxLength={OWNER_REASON_MAX} onChange={(event) => setReason(event.target.value)} data-testid="person-action-reason" />
        </label>
        {error ? (
          <p className="banner mt-3" data-hue="red" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn sm ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn sm ${danger ? 'danger' : 'primary'}`}
            disabled={busy || !canConfirm || Boolean(reasonError)}
            data-testid="person-action-confirm"
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                await onConfirm()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'That did not work. Nothing was changed.')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetDialog({ uid, name, onClose, onDone, run }: DialogProps) {
  const [reason, setReason] = useState('')
  return (
    <ActionDialog
      title="Send password reset"
      consequence={<p>Emails {name} a link to choose a new password. Their current password keeps working until they use it.</p>}
      reason={reason}
      setReason={setReason}
      confirmLabel="Send reset"
      canConfirm
      onClose={onClose}
      onConfirm={async () => {
        await run(() => ownerSendPasswordReset(uid, undefined, reason))
        onDone(`Password reset emailed to ${name}.`)
      }}
    />
  )
}

function NameDialog({ uid, person, documents, onClose, onDone, run }: Omit<DialogProps, 'name'> & { person: OwnerPersonRow; documents: OwnerPersonDocument[] }) {
  const kept = documents.find((doc) => doc.id === person.id) || documents[0]
  const parts = (kept?.name || person.name).split(' ')
  const [firstName, setFirstName] = useState(parts[0] || '')
  const [surname, setSurname] = useState(parts.slice(1).join(' '))
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<NameChangeSummary | null>(null)
  const [previewError, setPreviewError] = useState('')
  useEffect(() => {
    setPreview(null)
    setPreviewError('')
    if (!firstName.trim() || !surname.trim()) return
    const timer = window.setTimeout(() => {
      ownerChangeUserName({ uid, firstName, surname, preview: true })
        .then(setPreview)
        .catch((err: unknown) => setPreviewError(err instanceof Error ? err.message : 'Could not check this change.'))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [uid, firstName, surname])
  return (
    <ActionDialog
      title="Change name"
      consequence={<p>Changes the first name and surname everywhere {person.name} appears: each of their user records and the Operatives / Managers list rows on their email, in every organisation. It happens all at once or not at all.</p>}
      reason={reason}
      setReason={setReason}
      confirmLabel="Change name"
      canConfirm={Boolean(preview && !preview.unchanged)}
      onClose={onClose}
      onConfirm={async () => {
        await run(() => ownerChangeUserName({ uid, firstName, surname, reason }))
        onDone(`Name changed to ${firstName.trim()} ${surname.trim()}.`)
      }}
    >
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="f block text-sm font-semibold">
          First name
          <input className="pp-in mt-1" value={firstName} maxLength={80} onChange={(event) => setFirstName(event.target.value)} data-testid="person-first-name" />
        </label>
        <label className="f block text-sm font-semibold">
          Surname
          <input className="pp-in mt-1" value={surname} maxLength={80} onChange={(event) => setSurname(event.target.value)} data-testid="person-surname" />
        </label>
      </div>
      <div className="mt-3 text-sm" data-testid="person-name-preview">
        {previewError ? <p className="text-(--red)">{previewError}</p> : null}
        {preview ? (
          preview.unchanged ? (
            <p className="text-(--ink3)">That is already the name on every record.</p>
          ) : (
            <p>
              Will change {preview.users.length} user record{preview.users.length === 1 ? '' : 's'}
              {preview.rows.length ? ` and ${preview.rows.length} list row${preview.rows.length === 1 ? '' : 's'}` : ''}:{' '}
              {[...new Set([...preview.users, ...preview.rows].map((row) => row.organisation))].join(', ')}.
            </p>
          )
        ) : !previewError ? (
          <p className="text-(--ink3)">Checking what will change…</p>
        ) : null}
      </div>
    </ActionDialog>
  )
}

function EmailDialog({ uid, name, onClose, onDone, run }: DialogProps) {
  const [email, setEmail] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sendReset, setSendReset] = useState(true)
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<ChangeEmailPreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const typed = email.trim().toLowerCase()
  const matches = typed !== '' && typed === confirm.trim().toLowerCase()
  useEffect(() => {
    setPreview(null)
    setPreviewError('')
    if (!matches) return
    const timer = window.setTimeout(() => {
      ownerPreviewChangeEmail({ uid, newEmail: typed, sendReset })
        .then(setPreview)
        .catch((err: unknown) => setPreviewError(err instanceof Error ? err.message : 'Could not check this change.'))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [uid, typed, matches, sendReset])
  return (
    <ActionDialog
      title="Change login email"
      consequence={<p>Changes the email {name} signs in with (Firebase Auth), their user record, the company email claims and the list rows on the old email. They sign in with the new email straight away; the old one stops working.</p>}
      reason={reason}
      setReason={setReason}
      confirmLabel="Change email"
      canConfirm={matches && Boolean(preview)}
      onClose={onClose}
      onConfirm={async () => {
        const result = await run(() => ownerChangeUserEmail({ uid, newEmail: typed, confirmEmail: confirm, reason, sendReset }))
        onDone(
          result.incomplete.length
            ? `Login email changed, but these could not be updated: ${result.incomplete.join(', ')}.`
            : `Login email changed for ${name}.`
        )
      }}
    >
      <label className="f mt-3 block text-sm font-semibold">
        New login email
        <input className="pp-in mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} data-testid="person-new-email" />
      </label>
      <label className="f mt-2 block text-sm font-semibold">
        Type it again
        <input className="pp-in mt-1" type="email" value={confirm} onChange={(event) => setConfirm(event.target.value)} data-testid="person-new-email-confirm" />
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sendReset} onChange={(event) => setSendReset(event.target.checked)} />
        Email a password reset to the new address
      </label>
      <div className="mt-2 text-sm">
        {confirm && !matches ? <p className="text-(--red)">The two emails do not match.</p> : null}
        {previewError ? <p className="text-(--red)">{previewError}</p> : null}
        {preview ? (
          <p>
            Will update {preview.organizations} organisation{preview.organizations === 1 ? '' : 's'}: {preview.claimWrites} email claim
            {preview.claimWrites === 1 ? '' : 's'} added, {preview.claimDeletes} removed.
            {preview.membershipsRead ? '' : ' Their other memberships could not be read, so only the home company is updated.'}
          </p>
        ) : null}
      </div>
    </ActionDialog>
  )
}

function RevokeDialog({ uid, name, onClose, onDone, run }: DialogProps) {
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<RevokeSummary | null>(null)
  const [previewError, setPreviewError] = useState('')
  useEffect(() => {
    ownerRevokeSessions({ uid, preview: true })
      .then(setPreview)
      .catch((err: unknown) => setPreviewError(err instanceof Error ? err.message : 'Could not check this action.'))
  }, [uid])
  const count = preview?.accounts?.length ?? 0
  return (
    <ActionDialog
      title="Sign out everywhere"
      consequence={
        <p>
          Signs {name} out on every phone and browser. Each device asks them to sign in again when its current session runs
          out (within an hour at most). Their password is not changed.
        </p>
      }
      reason={reason}
      setReason={setReason}
      confirmLabel="Sign out everywhere"
      canConfirm={count > 0}
      danger
      onClose={onClose}
      onConfirm={async () => {
        const result = await run(() => ownerRevokeSessions({ uid, reason }))
        onDone(result.failed?.length ? `Signed out ${result.signedOut} account(s); ${result.failed.length} could not be signed out.` : `${name} is signed out everywhere.`)
      }}
    >
      <div className="mt-2 text-sm">
        {previewError ? <p className="text-(--red)">{previewError}</p> : null}
        {preview ? (
          count ? (
            <p>
              {count} sign-in account{count === 1 ? '' : 's'}: {preview.accounts?.map((account) => account.emailMasked).join(', ')}.
            </p>
          ) : (
            <p className="text-(--ink3)">This person has no sign-in account.</p>
          )
        ) : null}
      </div>
    </ActionDialog>
  )
}

function DeleteDialog({ uid, name, onClose, onDone, run }: DialogProps) {
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  return (
    <ActionDialog
      title="Delete unfinished sign-up"
      consequence={
        <p>
          Deletes {name}’s user record and login. Only for a sign-up that never finished: the server refuses anyone who
          belongs to a company in use, has a membership, or signed up in the last 12 months. This cannot be undone.
        </p>
      }
      reason={reason}
      setReason={setReason}
      confirmLabel="Delete"
      canConfirm={typed.trim() === 'DELETE'}
      danger
      onClose={onClose}
      onConfirm={async () => {
        await run(() => ownerDeleteUnfinishedUser(uid, reason))
        onDone(`${name} was deleted.`)
      }}
    >
      <label className="f mt-3 block text-sm font-semibold">
        Type DELETE to confirm
        <input className="pp-in mt-1" value={typed} onChange={(event) => setTyped(event.target.value)} />
      </label>
    </ActionDialog>
  )
}
