/**
 * iOS parity source: Views/WholesalersRevampViews.swift, Views/WholesalersView.swift
 * Spec: docs/ios-parity/sections/06-wholesalers.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BuildingOffice2Icon, PlusIcon } from '@heroicons/react/24/solid'
import type { MaterialSendRecord, Wholesaler, WholesalerContact } from '@/types'
import { useAuthStore } from '@/lib/stores/authStore'
import { newWholesalerId, useWholesalerStore } from '@/lib/stores/wholesalerStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { canAccessWholesalers, canViewWholesalerOrderHistory } from '@/lib/permissions'
import { consumeCreateQuery } from '@/lib/navigation/createMenu'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { EmptyState, IosFormModal, PageHeader } from '@/components/ios/primitives'

function cityFromAddress(address?: string) {
  if (!address) return ''
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] || parts[parts.length - 1] : address
}

export function WholesalersScreen({ selectedId }: { selectedId?: string }) {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { wholesalers, loading, error, loadWholesalers, saveWholesaler, deleteWholesaler } = useWholesalerStore()
  const { sendRecords, loadSendRecords } = useMaterialProjectStore()
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Wholesaler | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const canManage = canAccessWholesalers(user)
  const canHistory = canViewWholesalerOrderHistory(user)

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard')
  }, [user, canManage, router])

  useEffect(() => {
    if (!canManage) return
    if (consumeCreateQuery()) setEditor(emptyWholesaler())
  }, [canManage])

  useEffect(() => {
    if (!organization?.id) return
    loadWholesalers(organization.id)
    loadSendRecords(organization.id)
  }, [organization?.id, loadWholesalers, loadSendRecords])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = [...wholesalers].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    if (!query) return list
    return list.filter((row) => {
      const city = cityFromAddress(row.address).toLowerCase()
      return (
        row.name.toLowerCase().includes(query) ||
        (row.trade || '').toLowerCase().includes(query) ||
        city.includes(query) ||
        row.contacts.some(
          (contact) => contact.name.toLowerCase().includes(query) || contact.email.toLowerCase().includes(query)
        )
      )
    })
  }, [wholesalers, search])

  const selected = filtered.find((row) => row.id === selectedId) || wholesalers.find((row) => row.id === selectedId) || null
  const contactCount = wholesalers.reduce((sum, row) => sum + row.contacts.length, 0)
  const history = useMemo(() => {
    if (!selected) return []
    const emails = new Set(selected.contacts.map((c) => c.email.toLowerCase()))
    return sendRecords.filter((record) =>
      record.recipients.some(
        (recipient) =>
          emails.has((recipient.email || '').toLowerCase()) ||
          (recipient.wholesalerName || '').toLowerCase() === selected.name.toLowerCase()
      )
    )
  }, [sendRecords, selected])

  if (!user || !canManage) return null
  if (loading && wholesalers.length === 0) {
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
        onClick={() => setEditor(emptyWholesaler())}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[#185FA5]/40 bg-white px-4 py-3 text-left text-[#185FA5] shadow-sm"
      >
        <PlusIcon className="h-5 w-5" />
        <span className="font-semibold">Add wholesaler</span>
      </button>
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.4px] text-slate-500">
        Your wholesalers · {wholesalers.length} Wholesaler{wholesalers.length === 1 ? '' : 's'} · {contactCount} Contact
        {contactCount === 1 ? '' : 's'}
      </p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, trade or contact…"
        className="w-full rounded-xl border border-ios-search-border bg-white px-4 py-2.5 text-[15px]"
      />
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <EmptyState
            icon={<BuildingOffice2Icon className="h-[60px] w-[60px] text-gray-400" />}
            title="No wholesalers yet"
            subtitle="Add your first wholesaler to send material orders and quote requests from your projects."
          />
          <div className="flex justify-center">
            <button type="button" onClick={() => setEditor(emptyWholesaler())} className="rounded-xl bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white">
              + Add Wholesaler
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const primary = row.contacts.find((c) => c.isPrimary) || row.contacts[0]
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => router.push(`/dashboard/wholesalers/${row.id}`)}
                className={`w-full rounded-xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)] ${
                  selected?.id === row.id ? 'ring-2 ring-[#185FA5]/30' : ''
                }`}
              >
                <p className="text-[16px] font-bold">{row.name}</p>
                {row.trade ? <p className="mt-1 text-[13px] text-ios-muted">{row.trade}</p> : null}
                {primary ? (
                  <p className="mt-2 text-[13px] text-ios-muted">
                    <span className="mr-2 rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[10px] font-bold text-[#185FA5]">
                      PRIMARY
                    </span>
                    {primary.name}
                  </p>
                ) : null}
                {row.contacts.length > 1 ? (
                  <p className="mt-1 text-[12px] text-ios-muted">+{row.contacts.length - 1} more contacts</p>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const detail = selected ? (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Wholesaler</h2>
        <button type="button" onClick={() => setEditor(selected)} className="text-[15px] font-medium text-[#185FA5]">
          Edit
        </button>
      </div>
      <div className="rounded-xl bg-[#F2F2F7] p-5">
        <h3 className="text-[32px] font-bold leading-tight">{selected.name}</h3>
        {selected.trade ? <p className="mt-1 text-[15px] text-ios-muted">{selected.trade}</p> : null}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Total orders" value={history.filter((r) => r.requestType === 'order').length} />
        <Stat label="Contacts" value={selected.contacts.length} />
        <Stat label="Last order" value={history[0] ? history[0].sentAt.toLocaleDateString('en-GB') : '—'} />
      </div>
      {canHistory ? (
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="w-full rounded-xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
        >
          <p className="font-semibold">Quote & order history</p>
          <p className="mt-1 text-[13px] text-ios-muted">Search sends across all projects and small works</p>
        </button>
      ) : null}
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-slate-500">
          Contacts · {selected.contacts.length}
        </p>
        {selected.contacts.length === 0 ? (
          <p className="text-sm text-ios-muted">Add your first contact in Edit.</p>
        ) : (
          <div className="space-y-2">
            {selected.contacts.map((contact) => (
              <div key={contact.id} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <p className="font-medium">
                  {contact.name}{' '}
                  {contact.isPrimary ? (
                    <span className="ml-1 rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[10px] font-bold text-[#185FA5]">
                      PRIMARY
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-ios-muted">{contact.email}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-slate-500">Details</p>
        <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
          {selected.accountNumber ? (
            <p>
              <span className="font-semibold">Account number</span> {selected.accountNumber}
            </p>
          ) : null}
          {selected.address ? <p className="mt-2">{selected.address}</p> : null}
          {!selected.accountNumber && !selected.address ? <p className="text-ios-muted">No extra details.</p> : null}
        </div>
      </section>
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-slate-500">Recent activity</p>
        {history.slice(0, 5).length === 0 ? (
          <p className="text-sm text-ios-muted">No recent sends.</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((record) => (
              <div key={record.id} className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
                <p className="font-medium">
                  {record.requestType === 'order' ? 'Order' : 'Quote'} · {record.lines.length} item
                  {record.lines.length === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-ios-muted">
                  {record.lines
                    .slice(0, 3)
                    .map((line) => `${line.name} × ${line.quantity}`)
                    .join(' · ') || 'No line items'}
                  {record.lines.length > 3 ? ` · +${record.lines.length - 3} more` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  ) : (
    <div className="hidden rounded-2xl bg-[#F2F2F7] p-8 text-sm text-ios-muted xl:block">
      Select a wholesaler to see contacts and send history.
    </div>
  )

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Wholesalers" subtitle="Contacts and send history" hue="sw" />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="xl:grid xl:grid-cols-[400px_1fr] xl:gap-8">
        {list}
        {detail}
      </div>
      {editor ? (
        <WholesalerEditor
          value={editor}
          onCancel={() => setEditor(null)}
          onSave={async (next) => {
            if (!organization?.id) return
            await saveWholesaler(organization.id, next)
            setEditor(null)
            router.push(`/dashboard/wholesalers/${next.id}`)
          }}
          onDelete={
            editor.id && wholesalers.some((row) => row.id === editor.id)
              ? async () => {
                  if (!organization?.id) return
                  if (!window.confirm(`Are you sure you want to delete ${editor.name}? This cannot be undone.`)) return
                  await deleteWholesaler(organization.id, editor.id)
                  setEditor(null)
                  router.push('/dashboard/wholesalers')
                }
              : undefined
          }
        />
      ) : null}
      {historyOpen && selected ? (
        <HistorySheet
          name={selected.name}
          records={history}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[14px] border border-ios-border bg-white py-2.5 text-center">
      <p className="text-[20px] font-medium">{value}</p>
      <p className="mt-1 text-[12px] text-ios-muted">{label}</p>
    </div>
  )
}

function emptyWholesaler(): Wholesaler {
  const contactId = newUuid()
  return {
    id: newWholesalerId(),
    name: '',
    trade: '',
    address: '',
    accountNumber: '',
    primaryContactId: contactId,
    contacts: [{ id: contactId, name: '', email: '', isPrimary: true, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function WholesalerEditor({
  value,
  onCancel,
  onSave,
  onDelete,
}: {
  value: Wholesaler
  onCancel: () => void
  onSave: (next: Wholesaler) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const canSave =
    draft.name.trim().length > 0 &&
    draft.contacts.some((contact) => contact.name.trim() && contact.email.trim())

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    try {
      const contacts = draft.contacts.filter((contact) => contact.name.trim() && contact.email.trim())
      await onSave({ ...draft, contacts, name: draft.name.trim(), updatedAt: new Date() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <IosFormModal
      title={value.name ? 'Edit Wholesaler' : 'Add Wholesaler'}
      onCancel={onCancel}
      width="md"
      footer={
        <button type="submit" form="wholesaler-editor" disabled={!canSave || saving} className="w-full rounded-xl bg-[#185FA5] py-3 font-semibold text-white disabled:opacity-50">
          Save
        </button>
      }
    >
      <form id="wholesaler-editor" onSubmit={submit} className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ios-muted">Wholesaler details</p>
        <Field label="Name" required value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
        <Field label="Trade / category" value={draft.trade || ''} onChange={(trade) => setDraft({ ...draft, trade })} />
        <Field label="Address · optional" value={draft.address || ''} onChange={(address) => setDraft({ ...draft, address })} />
        <Field label="Account number · optional" value={draft.accountNumber || ''} onChange={(accountNumber) => setDraft({ ...draft, accountNumber })} />
        <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-ios-muted">
          Staff / contacts · {draft.contacts.length}
        </p>
        {!canSave ? <p className="text-sm text-red-600">Add at least one contact with name and email.</p> : null}
        {draft.contacts.map((contact, index) => (
          <div key={contact.id} className="rounded-xl bg-[#F2F2F7] p-3">
            <Field
              label="Name"
              value={contact.name}
              onChange={(name) => {
                const contacts = draft.contacts.map((row) => (row.id === contact.id ? { ...row, name } : row))
                setDraft({ ...draft, contacts })
              }}
            />
            <div className="mt-2">
              <Field
                label="Email"
                type="email"
                value={contact.email}
                onChange={(email) => {
                  const contacts = draft.contacts.map((row) => (row.id === contact.id ? { ...row, email } : row))
                  setDraft({ ...draft, contacts })
                }}
              />
            </div>
            {contact.isPrimary ? (
              <p className="mt-2 text-[12px] font-semibold text-[#185FA5]">PRIMARY · order & quote emails go here</p>
            ) : (
              <button
                type="button"
                className="mt-2 text-[13px] font-semibold text-[#185FA5]"
                onClick={() =>
                  setDraft({
                    ...draft,
                    primaryContactId: contact.id,
                    contacts: draft.contacts.map((row) => ({ ...row, isPrimary: row.id === contact.id })),
                  })
                }
              >
                Make primary
              </button>
            )}
            {draft.contacts.length > 1 ? (
              <button
                type="button"
                className="mt-2 block text-[13px] text-red-600"
                onClick={() => setDraft({ ...draft, contacts: draft.contacts.filter((row) => row.id !== contact.id) })}
              >
                Remove
              </button>
            ) : null}
            {index === draft.contacts.length - 1 ? null : null}
          </div>
        ))}
        <button
          type="button"
          className="text-[15px] font-semibold text-[#185FA5]"
          onClick={() =>
            setDraft({
              ...draft,
              contacts: [...draft.contacts, { id: newUuid(), name: '', email: '', isPrimary: false, createdAt: new Date() } satisfies WholesalerContact],
            })
          }
        >
          Add contact
        </button>
        {onDelete ? (
          <button type="button" onClick={() => void onDelete()} className="block text-sm font-semibold text-red-600">
            Delete Wholesaler
          </button>
        ) : null}
      </form>
    </IosFormModal>
  )
}

function HistorySheet({
  name,
  records,
  onClose,
}: {
  name: string
  records: MaterialSendRecord[]
  onClose: () => void
}) {
  const [type, setType] = useState<'quote' | 'order'>('quote')
  const [query, setQuery] = useState('')
  const [date, setDate] = useState('')
  const filtered = records.filter((record) => {
    if (record.requestType !== type) return false
    if (date) {
      const key = (record.materialsDate || record.sentAt).toISOString().slice(0, 10)
      if (key !== date) return false
    }
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return record.lines.some(
      (line) =>
        line.name.toLowerCase().includes(needle) ||
        (line.brand || '').toLowerCase().includes(needle) ||
        (line.productCode || '').toLowerCase().includes(needle)
    )
  })

  return (
    <IosFormModal title={`${name} history`} onCancel={onClose} width="md">
      <div className="space-y-4">
        <div className="inline-flex rounded-xl bg-[#E5E5EA] p-1">
          {(['quote', 'order'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold ${type === value ? 'bg-white shadow-sm' : 'text-ios-muted'}`}
            >
              {value === 'quote' ? 'Quotes' : 'Orders'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[13px] font-medium">
            Filter by materials day
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2" />
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search materials (name, brand, code)"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => { setDate(''); setQuery('') }} className="text-sm font-semibold text-[#185FA5]">
            Clear
          </button>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-ios-muted">No {type === 'quote' ? 'quotes' : 'orders'} match your filters</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((record) => (
              <div key={record.id} className="rounded-2xl border border-[#E5E5EA] bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-semibold">
                    {record.requestType === 'order' ? 'Order' : 'Quote'} · materials day{' '}
                    {(record.materialsDate || record.sentAt).toLocaleDateString('en-GB')}
                  </p>
                  <p className="text-[13px] text-ios-muted">by {record.sentBy}</p>
                </div>
                {record.lines.length === 0 ? (
                  <p className="mt-3 text-sm text-ios-muted">No line items were stored on this send.</p>
                ) : (
                  <div className="mt-3 divide-y divide-[#E5E5EA]">
                    {record.lines.map((line, index) => (
                      <div key={`${record.id}-${line.materialId || index}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{line.name}</p>
                          <p className="text-[13px] text-ios-muted">
                            {[line.brand, line.productCode, line.lengthDisplay].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold">
                          {line.quantity} {line.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </IosFormModal>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block text-[13px] font-medium">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={required ? 'Required' : 'Optional'}
        className="mt-1.5 w-full rounded-lg border border-ios-search-border bg-white px-3 py-2.5 text-[15px]"
      />
    </label>
  )
}
