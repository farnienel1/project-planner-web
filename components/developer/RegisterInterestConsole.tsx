'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, startOfWeek } from 'date-fns'
import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  addInterestNote,
  deleteInterestRegistration,
  setInterestStatus,
  useInterestRegistrations,
} from '@/lib/interest/interestStore'
import { INTEREST_STATUSES, INTEREST_STATUS_LABEL, type InterestStatus } from '@/lib/interest/registration'
import { REGISTRATION_HEADERS, registrationSheetRows, summarySheetRows } from '@/lib/interest/exportSheet'
import type { InterestRegistration } from '@/lib/interest/record'

const ORDER_KEY = 'pp.interest.order'

type SortKey = 'date' | 'company' | 'status'

function inRange(row: InterestRegistration, from: string, to: string): boolean {
  if (!from && !to) return true
  const when = row.createdAt
  if (!when) return false
  if (from && when < new Date(`${from}T00:00:00`)) return false
  if (to && when > new Date(`${to}T23:59:59`)) return false
  return true
}

export function filterInterestRows(
  rows: InterestRegistration[],
  filters: { status: string; source: string; teamSize: string; from: string; to: string; search: string; sort: SortKey }
): InterestRegistration[] {
  const q = filters.search.trim().toLowerCase()
  const next = rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.source && row.source !== filters.source) return false
    if (filters.teamSize && row.teamSize !== filters.teamSize) return false
    if (!inRange(row, filters.from, filters.to)) return false
    if (!q) return true
    return `${row.firstName} ${row.lastName} ${row.company} ${row.email}`.toLowerCase().includes(q)
  })
  next.sort((a, b) => {
    if (filters.sort === 'company') return a.company.localeCompare(b.company)
    if (filters.sort === 'status') return a.status.localeCompare(b.status) || (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
  })
  return next
}

export function RegisterInterestList() {
  const { rows, loading, error } = useInterestRegistrations()
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('date')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const sources = useMemo(() => Array.from(new Set(rows.map((row) => row.source || 'direct'))).sort(), [rows])
  const sizes = useMemo(() => Array.from(new Set(rows.map((row) => row.teamSize).filter(Boolean))).sort(), [rows])
  const visible = useMemo(
    () => filterInterestRows(rows, { status, source, teamSize, from, to, search, sort }),
    [rows, status, source, teamSize, from, to, search, sort]
  )

  useEffect(() => {
    try {
      window.sessionStorage.setItem(ORDER_KEY, JSON.stringify(visible.map((row) => row.id)))
    } catch {
      /* ignore */
    }
  }, [visible])

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const thisWeek = visible.filter((row) => row.createdAt && row.createdAt >= weekStart).length
  const thisMonth = visible.filter((row) => row.createdAt && row.createdAt >= monthStart).length
  const bySource = new Map<string, number>()
  for (const row of visible) bySource.set(row.source || 'direct', (bySource.get(row.source || 'direct') || 0) + 1)

  async function exportRows(list: InterestRegistration[]) {
    const XLSX = await import('xlsx')
    const body = registrationSheetRows(list)
    const sheet = XLSX.utils.aoa_to_sheet([Array.from(REGISTRATION_HEADERS), ...body]) as import('xlsx').WorkSheet & {
      '!views'?: Array<{ state: string; ySplit: number; xSplit: number }>
    }
    sheet['!cols'] = REGISTRATION_HEADERS.map((header, index) => {
      const width = Math.min(48, Math.max(header.length, ...body.map((row) => String(row[index] ?? '').split('\n')[0].length)) + 2)
      return { wch: width }
    })
    sheet['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0 }]
    for (let column = 0; column < REGISTRATION_HEADERS.length; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })] as (import('xlsx').CellObject & { s?: { font: { bold: boolean } } }) | undefined
      if (cell) cell.s = { font: { bold: true } }
    }
    const summary = XLSX.utils.aoa_to_sheet(summarySheetRows(list))
    summary['!cols'] = [{ wch: 24 }, { wch: 12 }]
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Registrations')
    XLSX.utils.book_append_sheet(book, summary, 'Summary')
    XLSX.writeFile(book, `project-planner-registrations-${format(new Date(), 'yyyy-MM-dd')}.xlsx`, { cellStyles: true })
  }

  return (
    <DeveloperShell
      title="Register interest"
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn sm" disabled={visible.length === 0} onClick={() => void exportRows(visible)}>
            Export
          </button>
          <button
            type="button"
            className="btn sm ghost"
            disabled={selected.length === 0}
            onClick={() => void exportRows(visible.filter((row) => selected.includes(row.id)))}
          >
            Export selected
          </button>
        </div>
      }
    >
      {error ? <p className="text-sm font-semibold text-[var(--red)]">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Counter label="Showing" value={visible.length} />
        <Counter label="This week" value={thisWeek} />
        <Counter label="This month" value={thisMonth} />
        <Counter label="Sources" value={[...bySource.entries()].map(([name, count]) => `${name} ${count}`).join(' · ') || '—'} />
      </div>
      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        <input className="pp-in" placeholder="Search name, company, email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="pp-in" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {INTEREST_STATUSES.map((item) => (
            <option key={item} value={item}>{INTEREST_STATUS_LABEL[item]}</option>
          ))}
        </select>
        <select className="pp-in" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">All sources</option>
          {sources.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select className="pp-in" value={teamSize} onChange={(event) => setTeamSize(event.target.value)}>
          <option value="">All team sizes</option>
          {sizes.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input className="pp-in" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
        <input className="pp-in" type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To" />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--ink2)]">
        Sort
        <select className="pp-in" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="date">Date</option>
          <option value="company">Company</option>
          <option value="status">Status</option>
        </select>
      </label>
      {loading ? <p className="text-sm text-[var(--ink3)]">Loading registrations…</p> : null}
      {!loading && visible.length === 0 ? <p className="text-sm text-[var(--ink3)]">No registrations match.</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs font-bold uppercase tracking-wide text-[var(--ink3)]">
            <tr>
              <th className="p-3" />
              <th className="p-3">Name</th>
              <th className="p-3">Company</th>
              <th className="p-3">Role</th>
              <th className="p-3">Team size</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Source</th>
              <th className="p-3">Registered</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    aria-label={`Select ${row.company}`}
                    onChange={(event) =>
                      setSelected((current) => (event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))
                    }
                  />
                </td>
                <td className="p-3">
                  <Link href={`/developer/register-interest/${row.id}`} className="font-semibold text-[var(--blue)]">
                    {row.firstName} {row.lastName}
                  </Link>
                </td>
                <td className="p-3">{row.company}</td>
                <td className="p-3">{row.role}</td>
                <td className="p-3">{row.teamSize}</td>
                <td className="p-3">
                  <button type="button" className="text-[var(--blue)]" onClick={() => void navigator.clipboard.writeText(row.email)}>
                    {row.email}
                  </button>
                </td>
                <td className="p-3">
                  {row.phone ? (
                    <a href={`tel:${row.phone}`} className="text-[var(--blue)]">{row.phone}</a>
                  ) : null}
                </td>
                <td className="p-3">{row.source || 'direct'}</td>
                <td className="p-3">{row.createdAt ? format(row.createdAt, 'd MMM yyyy, HH:mm') : ''}</td>
                <td className="p-3">
                  <select
                    className="pp-in"
                    value={row.status}
                    disabled={busy === row.id}
                    aria-label={`Status for ${row.company}`}
                    onChange={(event) => {
                      setBusy(row.id)
                      void setInterestStatus(row.id, event.target.value as InterestStatus).finally(() => setBusy(null))
                    }}
                  >
                    {INTEREST_STATUSES.map((item) => (
                      <option key={item} value={item}>{INTEREST_STATUS_LABEL[item]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DeveloperShell>
  )
}

function Counter({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink3)]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--ink)]">{value}</p>
    </div>
  )
}

export function RegisterInterestPerson({ id }: { id: string }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { rows, loading, error } = useInterestRegistrations()
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(ORDER_KEY)
      const parsed = raw ? (JSON.parse(raw) as unknown) : []
      if (Array.isArray(parsed)) setOrder(parsed.filter((item): item is string => typeof item === 'string'))
    } catch {
      setOrder([])
    }
  }, [])

  const row = rows.find((item) => item.id === id) || null
  const sequence = order.length ? order.filter((item) => rows.some((entry) => entry.id === item)) : rows.map((item) => item.id)
  const index = sequence.indexOf(id)
  const previousId = index > 0 ? sequence[index - 1] : null
  const nextId = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null
  const author = user ? `${user.firstName} ${user.surname}`.trim() || user.email : 'Owner'

  async function copyAll() {
    if (!row) return
    const text = [
      `${row.firstName} ${row.lastName}`,
      row.company,
      row.role,
      row.teamSize,
      row.email,
      row.phone,
      row.sectors.join(', '),
      row.currentTools,
      row.message,
      row.status,
      row.source,
      row.campaign,
    ].filter(Boolean).join('\n')
    await navigator.clipboard.writeText(text)
  }

  if (loading) {
    return (
      <DeveloperShell title="Registration" back={{ href: '/developer/register-interest', label: 'Registrations' }}>
        <p className="text-sm text-[var(--ink3)]">Loading…</p>
      </DeveloperShell>
    )
  }
  if (!row) {
    return (
      <DeveloperShell title="Registration" back={{ href: '/developer/register-interest', label: 'Registrations' }}>
        <p className="text-sm text-[var(--ink3)]">{error || 'That registration is not on the list.'}</p>
      </DeveloperShell>
    )
  }

  return (
    <DeveloperShell
      title={`${row.firstName} ${row.lastName}`}
      back={{ href: '/developer/register-interest', label: 'Registrations' }}
      actions={
        <div className="flex gap-2">
          <Link href={previousId ? `/developer/register-interest/${previousId}` : '#'} className={`btn sm ghost ${previousId ? '' : 'pointer-events-none opacity-40'}`} aria-disabled={!previousId}>
            Previous
          </Link>
          <Link href={nextId ? `/developer/register-interest/${nextId}` : '#'} className={`btn sm ghost ${nextId ? '' : 'pointer-events-none opacity-40'}`} aria-disabled={!nextId}>
            Next
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <p className="text-lg font-extrabold">{row.company}</p>
            <p className="text-sm text-[var(--ink2)]">{[row.role, row.teamSize].filter(Boolean).join(' · ')}</p>
            <span className="mt-2 inline-block rounded-full bg-[var(--blue-t)] px-2.5 py-1 text-xs font-bold text-[var(--blue)]">
              {INTEREST_STATUS_LABEL[row.status]}
            </span>
          </section>
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-bold">Contact</h2>
            <p className="mt-2">
              <a href={`mailto:${row.email}`} className="font-semibold text-[var(--blue)]">{row.email}</a>
              <button type="button" className="ml-2 text-xs font-semibold text-[var(--ink3)]" onClick={() => void navigator.clipboard.writeText(row.email)}>Copy</button>
            </p>
            {row.phone ? (
              <p className="mt-1">
                <a href={`tel:${row.phone}`} className="font-semibold text-[var(--blue)]">{row.phone}</a>
                <button type="button" className="ml-2 text-xs font-semibold text-[var(--ink3)]" onClick={() => void navigator.clipboard.writeText(row.phone)}>Copy</button>
              </p>
            ) : null}
          </section>
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-bold">What they told us</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {row.sectors.map((sector) => (
                <span key={sector} className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold">{sector}</span>
              ))}
            </div>
            {row.currentTools ? <p className="mt-3 text-sm text-[var(--ink2)]">Currently using {row.currentTools}</p> : null}
            {row.message ? <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--ink)]">{row.message}</p> : null}
          </section>
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-bold">Where they came from</h2>
            <p className="mt-2 text-sm text-[var(--ink2)]">
              {row.source || 'direct'}
              {row.campaign ? ` · ${row.campaign}` : ''}
              {row.createdAt ? ` · ${format(row.createdAt, 'd MMM yyyy, HH:mm')}` : ''}
            </p>
            {row.referrer ? <p className="mt-1 break-all text-sm text-[var(--ink3)]">{row.referrer}</p> : null}
            {row.pagePath ? <p className="mt-1 text-sm text-[var(--ink3)]">{row.pagePath}</p> : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ink2)]">Technical details</summary>
              <p className="mt-2 break-all text-xs text-[var(--ink3)]">{row.userAgent || 'No user agent stored.'}</p>
            </details>
          </section>
        </div>
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <label className="text-sm font-bold" htmlFor="interest-status">Status</label>
            <select
              id="interest-status"
              className="pp-in mt-2 w-full"
              value={row.status}
              disabled={saving}
              onChange={(event) => {
                setSaving(true)
                void setInterestStatus(row.id, event.target.value as InterestStatus).finally(() => setSaving(false))
              }}
            >
              {INTEREST_STATUSES.map((item) => (
                <option key={item} value={item}>{INTEREST_STATUS_LABEL[item]}</option>
              ))}
            </select>
          </section>
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-bold">Notes</h2>
            <ul className="mt-2 space-y-2">
              {row.notes.map((entry) => (
                <li key={entry.id} className="rounded-xl bg-[var(--soft)] p-3 text-sm">
                  <p className="whitespace-pre-wrap">{entry.body}</p>
                  <p className="mt-1 text-xs text-[var(--ink3)]">
                    {entry.authorName}
                    {entry.createdAt.getTime() ? ` · ${format(entry.createdAt, 'd MMM yyyy, HH:mm')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <textarea className="pp-in mt-3 w-full" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Called Tuesday, ringing back after the Bristol job." />
            <button
              type="button"
              className="btn sm primary mt-2"
              disabled={!note.trim() || saving}
              onClick={() => {
                setSaving(true)
                void addInterestNote(row.id, note, author)
                  .then(() => setNote(''))
                  .finally(() => setSaving(false))
              }}
            >
              Save note
            </button>
          </section>
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <a className="btn sm block" href={`mailto:${row.email}?subject=${encodeURIComponent(`Project Planner — ${row.company}`)}`}>
              Email them
            </a>
            <button type="button" className="btn sm mt-2 w-full" onClick={() => void copyAll()}>
              Copy all details
            </button>
            {confirmDelete ? (
              <div className="mt-3 rounded-xl bg-[var(--red-t)] p-3">
                <p className="text-sm font-semibold text-[var(--red)]">Remove this registration? This deletes their personal details.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn sm" onClick={() => setConfirmDelete(false)}>Keep it</button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => {
                      void deleteInterestRegistration(row.id).then(() => router.push('/developer/register-interest'))
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn sm danger mt-2 w-full" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
          </section>
        </div>
      </div>
    </DeveloperShell>
  )
}
