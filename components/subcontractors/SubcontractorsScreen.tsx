/**
 * iOS parity source: Views/SubcontractorsView.swift
 * Spec: docs/ios-parity/sections/08-sub-contractors.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, UserGroupIcon } from '@heroicons/react/24/solid'
import type { Subcontractor, SubcontractorContact } from '@/types'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { canManageSubcontractors } from '@/lib/permissions'
import { consumeCreateQuery } from '@/lib/navigation/createMenu'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { IosFormModal } from '@/components/ios/primitives'

const POSITIONS = ['Finance', 'Contract Manager', 'Project Manager', 'Site Manager', 'Supervisor', 'Installer']

export function SubcontractorsScreen({ selectedId }: { selectedId?: string }) {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { subcontractors, loading, error, loadSubcontractors, saveSubcontractor, deleteSubcontractor } =
    useSubcontractorStore()
  const [search, setSearch] = useState('')
  const [trade, setTrade] = useState('All')
  const [editor, setEditor] = useState<Subcontractor | null>(null)
  const [operativeEditor, setOperativeEditor] = useState<{ firm: Subcontractor; contact?: SubcontractorContact } | null>(
    null
  )
  const canManage = canManageSubcontractors(user)

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard')
  }, [user, canManage, router])

  useEffect(() => {
    if (!canManage) return
    if (consumeCreateQuery()) setEditor(emptyFirm())
  }, [canManage])

  useEffect(() => {
    if (organization?.id) loadSubcontractors(organization.id)
  }, [organization?.id, loadSubcontractors])

  const trades = useMemo(() => {
    const set = new Set(subcontractors.map((row) => row.subcontractorType).filter(Boolean))
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [subcontractors])

  const sorted = useMemo(
    () => [...subcontractors].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [subcontractors]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sorted.filter((row) => {
      if (trade !== 'All' && row.subcontractorType.toLowerCase() !== trade.toLowerCase()) return false
      if (!query) return true
      return row.name.toLowerCase().includes(query) || row.subcontractorType.toLowerCase().includes(query)
    })
  }, [sorted, search, trade])

  const selected = filtered.find((row) => row.id === selectedId) || subcontractors.find((row) => row.id === selectedId) || null
  const operativeCount = subcontractors.reduce((sum, row) => sum + row.contacts.length, 0)

  function chooseTrade(next: string) {
    setTrade(next)
    const query = search.trim().toLowerCase()
    const list = sorted.filter((row) => {
      if (next !== 'All' && row.subcontractorType.toLowerCase() !== next.toLowerCase()) return false
      if (!query) return true
      return row.name.toLowerCase().includes(query) || row.subcontractorType.toLowerCase().includes(query)
    })
    if (list[0]) router.push(`/dashboard/sub-contractors/${list[0].id}`)
    else router.push('/dashboard/sub-contractors')
  }

  useEffect(() => {
    if (loading || sorted.length === 0) return
    if (selectedId) return
    const first = filtered[0]
    if (first) router.replace(`/dashboard/sub-contractors/${first.id}`)
  }, [loading, sorted.length, selectedId, filtered, router])

  if (!user || !canManage) return null
  if (loading && subcontractors.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
      </div>
    )
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SC'

  const list = (
    <div className="stack" style={{ gap: 12 }}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search firms or trades…"
        className="in"
        aria-label="Search firms or trades"
      />
      <div className="chips">
        {trades.map((item) => (
          <button
            key={item}
            type="button"
            className={`chip ${trade === item ? 'on' : ''}`}
            data-hue="sched"
            onClick={() => chooseTrade(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty card pad">
          <h3>No sub contractors yet</h3>
          <p>Add your first sub contractor to start booking them to projects and small works.</p>
          <button type="button" className="btn primary" onClick={() => setEditor(emptyFirm())}>
            New sub contractor
          </button>
        </div>
      ) : (
        <div className="rows">
          {filtered.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => router.push(`/dashboard/sub-contractors/${row.id}`)}
              className={`ritem ${selected?.id === row.id ? 'sel' : ''}`}
              data-hue="sched"
            >
              <span className="ico-chip" style={{ borderRadius: 12 }}>
                {initials(row.name)}
              </span>
              <span className="grow">
                <span className="t">{row.name}</span>
                <span className="s">
                  {row.contacts.map((c) => c.name).filter(Boolean).slice(0, 3).join(', ') || 'Roster on record'}
                </span>
              </span>
              <span className="row" style={{ gap: 6 }}>
                <span className="pill" data-hue="daily">
                  {row.subcontractorType}
                </span>
                <span className="count soft">{row.contacts.length}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const detail = selected ? (
    <section className="card pad" data-hue="sched">
      <div className="row" style={{ marginBottom: 16 }}>
        <span className="ico-chip lg" style={{ borderRadius: 24 }}>
          {initials(selected.name)}
        </span>
        <div className="grow">
          <h2 className="h2" style={{ fontSize: 22 }}>{selected.name}</h2>
          <span className="pill" data-hue="daily">
            {selected.subcontractorType}
          </span>
          {selected.website ? <p className="small" style={{ marginTop: 6 }}>{selected.website}</p> : null}
          {selected.address ? <p className="muted small">{selected.address}</p> : null}
        </div>
        <button type="button" onClick={() => setEditor(selected)} className="btn">
          Edit
        </button>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <h3 className="h2 grow" style={{ fontSize: 16 }}>
          Roster · {selected.contacts.length} operative{selected.contacts.length === 1 ? '' : 's'}
        </h3>
        <button type="button" className="btn sm tint" onClick={() => setOperativeEditor({ firm: selected })}>
          Add operative
        </button>
      </div>
      {selected.contacts.length === 0 ? (
        <p className="muted">No operatives added yet.</p>
      ) : (
        <div className="rows">
          {selected.contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              className="ritem"
              style={{ boxShadow: 'none', background: 'var(--soft)' }}
              onClick={() => setOperativeEditor({ firm: selected, contact })}
            >
              <span className="ico-chip" data-hue="daily">
                {initials(contact.name)}
              </span>
              <span className="grow">
                <span className="t">{contact.name}</span>
                <span className="s">
                  {[contact.position, contact.tradeType, contact.email, contact.contactNumber].filter(Boolean).join(' · ') ||
                    selected.subcontractorType}
                </span>
              </span>
              <span className="btn sm">Edit</span>
            </button>
          ))}
        </div>
      )}
    </section>
  ) : (
    <div className="empty card pad">
      <h3>Select a firm</h3>
      <p>See its roster, add operatives, and edit firm details.</p>
    </div>
  )

  return (
    <div className="stack" data-hue="sched">
      <div className="phead" data-hue="sched">
        <div className="badge-ico">
          <UserGroupIcon className="h-6 w-6" />
        </div>
        <div>
          <h1>Sub contractors</h1>
          <div className="sub">
            Your sub contractors · {subcontractors.length} firm{subcontractors.length === 1 ? '' : 's'} · {operativeCount}{' '}
            operative{operativeCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="acts">
          <button type="button" className="btn primary" onClick={() => setEditor(emptyFirm())}>
            <PlusIcon className="h-4 w-4" />
            New sub contractor
          </button>
        </div>
      </div>
      {error ? <p className="banner" data-hue="red">{error}</p> : null}
      <div className="grid gmain">
        {list}
        <div style={{ position: 'sticky', top: 10 }}>{detail}</div>
      </div>
      {editor ? (
        <FirmEditor
          value={editor}
          tradeSuggestions={trades.filter((item) => item !== 'All')}
          onCancel={() => setEditor(null)}
          onSave={async (next) => {
            if (!organization?.id) return
            await saveSubcontractor(organization.id, next)
            setEditor(null)
            router.push(`/dashboard/sub-contractors/${next.id}`)
          }}
          onDelete={
            subcontractors.some((row) => row.id === editor.id)
              ? async () => {
                  if (!organization?.id) return
                  if (!window.confirm(`Delete ${editor.name}?`)) return
                  await deleteSubcontractor(organization.id, editor.id)
                  setEditor(null)
                  router.push('/dashboard/sub-contractors')
                }
              : undefined
          }
        />
      ) : null}
      {operativeEditor ? (
        <OperativeEditor
          firmName={operativeEditor.firm.name}
          value={operativeEditor.contact}
          onCancel={() => setOperativeEditor(null)}
          onSave={async (contact) => {
            if (!organization?.id) return
            const firm = operativeEditor.firm
            const contacts = firm.contacts.some((row) => row.id === contact.id)
              ? firm.contacts.map((row) => (row.id === contact.id ? contact : row))
              : [...firm.contacts, contact]
            await saveSubcontractor(organization.id, { ...firm, contacts, updatedAt: new Date() })
            setOperativeEditor(null)
          }}
        />
      ) : null}
    </div>
  )
}

function emptyFirm(): Subcontractor {
  return {
    id: newUuid(),
    name: '',
    subcontractorType: '',
    website: '',
    address: '',
    contacts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function FirmEditor({
  value,
  tradeSuggestions,
  onCancel,
  onSave,
  onDelete,
}: {
  value: Subcontractor
  tradeSuggestions: string[]
  onCancel: () => void
  onSave: (next: Subcontractor) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const valid = draft.name.trim() && draft.subcontractorType.trim()
  return (
    <IosFormModal
      title={value.name ? 'Edit sub contractor' : 'New sub contractor'}
      onCancel={onCancel}
      footer={
        <button
          type="submit"
          form="firm-editor"
          disabled={!valid || saving}
          className="w-full rounded-xl bg-[var(--blue)] py-3 font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      }
    >
      <form
        id="firm-editor"
        onSubmit={async (event: FormEvent) => {
          event.preventDefault()
          if (!valid) return
          setSaving(true)
          try {
            await onSave({
              ...draft,
              name: draft.name.trim(),
              subcontractorType: draft.subcontractorType.trim(),
              website: draft.website?.trim(),
              address: draft.address?.trim(),
              updatedAt: new Date(),
            })
          } finally {
            setSaving(false)
          }
        }}
        className="space-y-3"
      >
        <label className="block text-sm font-medium">
          Sub Contractor Name *
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Enter sub contractor name"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          Trade *
          <input
            required
            list="trade-suggestions"
            value={draft.subcontractorType}
            onChange={(e) => setDraft({ ...draft, subcontractorType: e.target.value })}
            placeholder="Enter trade type here"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
          <datalist id="trade-suggestions">
            {tradeSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-medium">
          Website · optional
          <input value={draft.website || ''} onChange={(e) => setDraft({ ...draft, website: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Address · optional
          <input value={draft.address || ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <p className="text-[13px] text-[var(--ink3)]">Names only · no logins</p>
        {onDelete ? (
          <button type="button" onClick={() => void onDelete()} className="text-sm font-semibold text-red-600">
            Delete
          </button>
        ) : null}
      </form>
    </IosFormModal>
  )
}

function OperativeEditor({
  firmName,
  value,
  onCancel,
  onSave,
}: {
  firmName: string
  value?: SubcontractorContact
  onCancel: () => void
  onSave: (contact: SubcontractorContact) => Promise<void>
}) {
  const [first, setFirst] = useState(value?.name.split(' ')[0] || '')
  const [last, setLast] = useState(value?.name.split(' ').slice(1).join(' ') || '')
  const [email, setEmail] = useState(value?.email || '')
  const [phone, setPhone] = useState(value?.contactNumber || '')
  const [position, setPosition] = useState(value?.position || 'Installer')
  const [tradeType, setTradeType] = useState(value?.tradeType || '')
  const [saving, setSaving] = useState(false)
  const valid = first.trim() && last.trim()
  return (
    <IosFormModal
      title={value ? 'Edit operative' : 'Add operative'}
      onCancel={onCancel}
      footer={
        <button
          type="submit"
          form="op-editor"
          disabled={!valid || saving}
          className="w-full rounded-xl bg-[var(--blue)] py-3 font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      }
    >
      <form
        id="op-editor"
        onSubmit={async (event: FormEvent) => {
          event.preventDefault()
          if (!valid) return
          setSaving(true)
          try {
            await onSave({
              id: value?.id || newUuid(),
              name: `${first.trim()} ${last.trim()}`,
              email: email.trim(),
              contactNumber: phone.trim(),
              position,
              tradeType: tradeType.trim(),
              createdAt: value?.createdAt || new Date(),
            })
          } finally {
            setSaving(false)
          }
        }}
        className="space-y-3"
      >
        <p className="text-[13px] text-[var(--ink3)]">Adding to this firm&apos;s roster · {firmName}</p>
        <label className="block text-sm font-medium">
          First name *
          <input required value={first} onChange={(e) => setFirst(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Last name *
          <input required value={last} onChange={(e) => setLast(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Position
          <select value={position} onChange={(e) => setPosition(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
            {POSITIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Trade type
          <input value={tradeType} onChange={(e) => setTradeType(e.target.value)} placeholder="Search trade type suggestions" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
      </form>
    </IosFormModal>
  )
}
