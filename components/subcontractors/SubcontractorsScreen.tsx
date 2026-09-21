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
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { EmptyState, FilterChip, IosFormModal, PageHeader } from '@/components/ios/primitives'

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
    if (organization?.id) loadSubcontractors(organization.id)
  }, [organization?.id, loadSubcontractors])

  const trades = useMemo(() => {
    const set = new Set(subcontractors.map((row) => row.subcontractorType).filter(Boolean))
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [subcontractors])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...subcontractors]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .filter((row) => {
        if (trade !== 'All' && row.subcontractorType.toLowerCase() !== trade.toLowerCase()) return false
        if (!query) return true
        return row.name.toLowerCase().includes(query) || row.subcontractorType.toLowerCase().includes(query)
      })
  }, [subcontractors, search, trade])

  const selected = subcontractors.find((row) => row.id === selectedId) || null
  const operativeCount = subcontractors.reduce((sum, row) => sum + row.contacts.length, 0)

  if (!user || !canManage) return null
  if (loading && subcontractors.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#185FA5]" />
      </div>
    )
  }

  const list = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setEditor(emptyFirm())}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[#185FA5]/40 bg-white px-4 py-3 text-[#185FA5]"
      >
        <PlusIcon className="h-5 w-5" />
        <span className="font-semibold">New sub contractor</span>
      </button>
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-slate-500">
        Your sub contractors · {subcontractors.length} Firm{subcontractors.length === 1 ? '' : 's'} · {operativeCount}{' '}
        Operative{operativeCount === 1 ? '' : 's'}
      </p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search firms or trades…"
        className="w-full rounded-xl border border-ios-search-border px-4 py-2.5"
      />
      <div className="flex flex-wrap gap-2">
        {trades.map((item) => (
          <FilterChip key={item} title={item} selected={trade === item} onClick={() => setTrade(item)} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <EmptyState
            icon={<UserGroupIcon className="h-[60px] w-[60px] text-gray-400" />}
            title="No sub contractors yet"
            subtitle="Add your first sub contractor to start booking them to projects and small works."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => router.push(`/dashboard/sub-contractors/${row.id}`)}
              className={`w-full rounded-xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)] ${
                selected?.id === row.id ? 'ring-2 ring-[#185FA5]/30' : ''
              }`}
            >
              <p className="text-[16px] font-bold">{row.name}</p>
              <p className="mt-1 text-[13px]">
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-800">{row.subcontractorType}</span>
                <span className="ml-2 text-ios-muted">
                  {row.contacts.length} Operative{row.contacts.length === 1 ? '' : 's'}
                </span>
              </p>
              {row.contacts.slice(0, 3).map((contact) => (
                <p key={contact.id} className="mt-1 text-[12px] text-ios-muted">
                  {contact.name}
                </p>
              ))}
              {row.contacts.length > 3 ? (
                <p className="text-[12px] text-[#185FA5]">More (+{row.contacts.length - 3})</p>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const detail = selected ? (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Firm details</h2>
        <button type="button" onClick={() => setEditor(selected)} className="text-[15px] font-medium text-[#185FA5]">
          Edit
        </button>
      </div>
      <div className="rounded-xl bg-[#F2F2F7] p-5">
        <h3 className="text-[32px] font-bold leading-tight">{selected.name}</h3>
        <p className="mt-1 text-[15px] text-ios-muted">{selected.subcontractorType}</p>
        {selected.website ? <p className="mt-2 text-sm">{selected.website}</p> : null}
        {selected.address ? <p className="text-sm text-ios-muted">{selected.address}</p> : null}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-slate-500">Operatives</p>
        <button
          type="button"
          onClick={() => setOperativeEditor({ firm: selected })}
          className="text-[15px] font-semibold text-[#185FA5]"
        >
          Add operative
        </button>
      </div>
      {selected.contacts.length === 0 ? (
        <p className="text-sm text-ios-muted">No operatives added yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F2F2F7] text-[12px] uppercase text-ios-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
              </tr>
            </thead>
            <tbody>
              {selected.contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="cursor-pointer border-t hover:bg-slate-50"
                  onClick={() => setOperativeEditor({ firm: selected, contact })}
                >
                  <td className="px-4 py-3 font-medium">{contact.name}</td>
                  <td className="px-4 py-3">{contact.position}</td>
                  <td className="px-4 py-3">{contact.email || '—'}</td>
                  <td className="px-4 py-3">{contact.contactNumber || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  ) : (
    <div className="hidden rounded-2xl bg-[#F2F2F7] p-8 text-sm text-ios-muted xl:block">
      Select a firm to see its roster.
    </div>
  )

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Sub contractors" />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="xl:grid xl:grid-cols-[400px_1fr] xl:gap-8">
        {list}
        {detail}
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
          className="w-full rounded-xl bg-[#185FA5] py-3 font-semibold text-white disabled:opacity-50"
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
        <p className="text-[13px] text-ios-muted">Names only · no logins</p>
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
          className="w-full rounded-xl bg-[#185FA5] py-3 font-semibold text-white disabled:opacity-50"
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
        <p className="text-[13px] text-ios-muted">Adding to this firm&apos;s roster · {firmName}</p>
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
