/**
 * iOS parity source: Views/MaterialsSendListSheet.swift
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { formatSiteAddress } from '@/lib/maps/siteAddress'
import { materialStatusLabel } from '@/lib/maps/siteLocation'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { FormInput } from '@/components/forms/FormShell'
import { FeatureCard, StatusPill, materialStatusTone } from '@/components/projects/features/featureUi'
import {
  MULTIPLE_WHOLESALER_ORDER_MESSAGE,
  buildRecipientSnapshots,
  orderBlockedForMultipleWholesalers,
  parseOneOffRecipient,
  partitionMaterialsForResend,
  resendHeadline,
  resendSubheadline,
  type MaterialSendRequestType,
  type OneOffRecipient,
} from '@/lib/materials/sendListLogic'
import type { Project, ProjectMaterialLine, Wholesaler } from '@/types'

type Props = {
  project: Project
  materials: ProjectMaterialLine[]
  materialsDay: Date
  wholesalers: Wholesaler[]
  onClose: () => void
  onSent: () => void
}

export function MaterialsSendListSheet({
  project,
  materials,
  materialsDay,
  wholesalers,
  onClose,
  onSent,
}: Props) {
  const { organization, user } = useAuthStore()
  const { saveSendRecord, updateMaterialWorkflowStatuses } = useMaterialProjectStore()

  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [oneOffRecipients, setOneOffRecipients] = useState<OneOffRecipient[]>([])
  const [newRecipientName, setNewRecipientName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(
    () => new Set(materials.map((item) => item.id))
  )
  const [materialSelectionExpanded, setMaterialSelectionExpanded] = useState(false)
  const [expandedWholesalerIds, setExpandedWholesalerIds] = useState<Set<string>>(new Set())
  const [sendAsPlainText, setSendAsPlainText] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [multiWholesalerAlert, setMultiWholesalerAlert] = useState(false)
  const [reviewType, setReviewType] = useState<MaterialSendRequestType | null>(null)
  const [excludedMaterialIds, setExcludedMaterialIds] = useState<Set<string>>(new Set())
  const [confirmation, setConfirmation] = useState<{
    requestType: MaterialSendRequestType
    itemCount: number
    recipientCount: number
  } | null>(null)

  useEffect(() => {
    setSelectedMaterialIds(new Set(materials.map((item) => item.id)))
  }, [materials])

  const siteAddress = formatSiteAddress(project)
  const recipientCount = selectedContactIds.size + oneOffRecipients.length
  const selectedMaterials = useMemo(
    () => materials.filter((item) => selectedMaterialIds.has(item.id)),
    [materials, selectedMaterialIds]
  )

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addOneOff = () => {
    const parsed = parseOneOffRecipient(newRecipientName, newEmail)
    if (!parsed) return
    setOneOffRecipients((prev) => [...prev.filter((row) => row.email.toLowerCase() !== parsed.email.toLowerCase()), parsed])
    setNewRecipientName('')
    setNewEmail('')
  }

  const beginSend = (type: MaterialSendRequestType) => {
    if (selectedMaterials.length === 0 || recipientCount === 0) return
    if (orderBlockedForMultipleWholesalers(type, wholesalers, selectedContactIds)) {
      setMultiWholesalerAlert(true)
      return
    }
    const partitioned = partitionMaterialsForResend(selectedMaterials, type)
    if (partitioned.needsDialog) {
      setExcludedMaterialIds(new Set())
      setReviewType(type)
      return
    }
    void proceedSend(type, selectedMaterials.map((item) => item.id))
  }

  const proceedSend = async (type: MaterialSendRequestType, materialIds: string[]) => {
    if (!organization?.id || !user || materialIds.length === 0) return
    setReviewType(null)
    setIsSending(true)
    setError(null)
    const items = materials.filter((item) => materialIds.includes(item.id))
    const recipients = buildRecipientSnapshots(wholesalers, selectedContactIds, oneOffRecipients)
    const senderName = `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email
    try {
      const headers = await jsonAuthHeaders()
      const response = await fetch('/api/materials/send-request-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestType: type,
          sendAsPlainText,
          jobNumber: project.jobNumber,
          siteName: project.siteName,
          siteAddress,
          senderName,
          senderEmail: user.email,
          senderPhone: user.mobileNumber,
          senderCompany: organization.name,
          companyLogoURL: organization.companyLogoURL,
          recipients: recipients.map((row) => ({ name: row.name, email: row.email })),
          materials: items.map((item) => ({
            material: item.material,
            quantity: item.quantity,
            unit: item.unit,
            brand: item.brand,
            productCode: item.productCode,
            notes: item.notes,
          })),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send material list')
      }

      await saveSendRecord(organization.id, {
        id: newUuid(),
        projectId: project.id,
        requestType: type,
        sentAt: new Date(),
        materialsDate: materialsDay,
        sentBy: senderName,
        recipients: recipients.map((row) => ({
          name: row.name,
          email: row.email,
          wholesalerName: row.wholesalerName,
        })),
        lines: items.map((item) => ({
          materialId: item.id,
          name: item.material,
          quantity: item.quantity,
          unit: item.unit,
          brand: item.brand,
          productCode: item.productCode,
        })),
      })
      await updateMaterialWorkflowStatuses(
        organization.id,
        items.map((item) => item.id),
        type === 'order' ? 'ordered' : 'sentForQuote',
        type
      )
      setConfirmation({ requestType: type, itemCount: items.length, recipientCount: recipients.length })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send material list')
    } finally {
      setIsSending(false)
    }
  }

  if (confirmation) {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl">
          <CheckCircleIcon className="mx-auto h-14 w-14 text-[#0F6E56]" />
          <p className="mt-4 text-xl font-semibold text-slate-900">
            {confirmation.requestType === 'quote' ? 'Quote sent' : 'Order placed'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sent to {confirmation.recipientCount} recipients · {confirmation.itemCount} items
          </p>
          <button
            type="button"
            onClick={() => {
              onSent()
              onClose()
            }}
            className="mt-6 rounded-xl bg-[#0F6E56] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  if (reviewType) {
    const partitioned = partitionMaterialsForResend(selectedMaterials, reviewType)
    const continueIds = [
      ...partitioned.alreadyQuoted.filter((item) => !excludedMaterialIds.has(item.id)).map((item) => item.id),
      ...partitioned.alreadyOrdered.filter((item) => !excludedMaterialIds.has(item.id)).map((item) => item.id),
      ...partitioned.fresh.map((item) => item.id),
    ]
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <button type="button" className="text-sm font-medium text-[var(--blue)]" onClick={() => setReviewType(null)}>
              Cancel
            </button>
            <p className="text-sm font-semibold text-slate-900">Review materials</p>
            <button
              type="button"
              disabled={continueIds.length === 0 || isSending}
              className="text-sm font-semibold text-[var(--blue)] disabled:opacity-40"
              onClick={() => void proceedSend(reviewType, continueIds)}
            >
              Continue
            </button>
          </header>
          <div className="space-y-4 overflow-y-auto p-5">
            <p className="text-base font-semibold text-slate-900">
              {resendHeadline(partitioned.alreadyQuoted.length, partitioned.alreadyOrdered.length)}
            </p>
            <p className="text-sm text-slate-500">{resendSubheadline(reviewType)}</p>
            {partitioned.alreadyQuoted.length > 0 && (
              <ReviewSection
                title="Already sent for quote"
                items={partitioned.alreadyQuoted}
                excluded={excludedMaterialIds}
                onToggle={(id) =>
                  setExcludedMaterialIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
              />
            )}
            {partitioned.alreadyOrdered.length > 0 && (
              <ReviewSection
                title="Already ordered"
                items={partitioned.alreadyOrdered}
                excluded={excludedMaterialIds}
                onToggle={(id) =>
                  setExcludedMaterialIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
              />
            )}
            {partitioned.fresh.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-800">New items</p>
                <div className="mt-2 space-y-2">
                  {partitioned.fresh.map((item) => (
                    <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-900">{item.material}</p>
                      <p className="text-xs text-slate-500">{materialStatusLabel(item.status)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex h-[96vh] w-full max-w-2xl flex-col overflow-hidden bg-[var(--bg)] shadow-xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--blue)]">
            Cancel
          </button>
          <p className="text-sm font-semibold text-slate-900">Send list</p>
          <span className="w-14" />
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-4">
          {error && <ErrorBanner message={error} />}

          <FeatureCard className="p-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-[var(--blue)]">{project.jobNumber}</p>
              <p className="text-xs font-medium text-slate-900">{project.siteName}</p>
              <span className="ml-auto rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[10px] font-medium text-[#0F6E56]">
                {selectedMaterialIds.size} items
              </span>
            </div>
            {siteAddress && <p className="mt-1 text-[10px] text-slate-500">{siteAddress}</p>}
            {materials.length > 0 && (
              <button
                type="button"
                onClick={() => setMaterialSelectionExpanded((v) => !v)}
                className="mt-2 flex w-full items-center justify-between text-[10px] font-medium text-slate-500"
              >
                Materials in this send
                {materialSelectionExpanded ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
              </button>
            )}
            {materialSelectionExpanded && (
              <div className="mt-2 space-y-2 rounded-[10px] bg-white p-2">
                {materials.map((item) => {
                  const selected = selectedMaterialIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleMaterial(item.id)}
                      className={`flex w-full items-start gap-2 text-left ${selected ? '' : 'opacity-60'}`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${
                          selected ? 'border-[var(--blue)] bg-[var(--blue)] text-white' : 'border-slate-300'
                        }`}
                      >
                        {selected ? '✓' : ''}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-xs font-medium ${selected ? 'text-slate-900' : 'text-slate-500'}`}>
                          {item.material}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatusPill label={materialStatusLabel(item.status)} tone={materialStatusTone(item.status)} />
                          {item.lastSentAt && (
                            <span className="text-[10px] text-slate-400">{format(item.lastSentAt, 'd MMM HH:mm')}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </FeatureCard>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Wholesalers · {selectedContactIds.size} selected
            </p>
            <FeatureCard className="overflow-hidden">
              {wholesalers.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No wholesalers in this organisation yet.</p>
              ) : (
                wholesalers.map((wholesaler, index) => {
                  const expanded = expandedWholesalerIds.has(wholesaler.id)
                  const selectedInGroup = wholesaler.contacts.filter((c) => selectedContactIds.has(c.id)).length
                  return (
                    <div key={wholesaler.id} className={index > 0 ? 'border-t border-slate-100' : ''}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedWholesalerIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(wholesaler.id)) next.delete(wholesaler.id)
                            else next.add(wholesaler.id)
                            return next
                          })
                        }
                        className="flex w-full items-center gap-2.5 px-3 py-3 text-left"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#185FA5] to-[#378ADD] text-[10px] font-medium text-white">
                          {wholesaler.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-slate-900">{wholesaler.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {wholesaler.contacts.length} contact{wholesaler.contacts.length === 1 ? '' : 's'}
                          </span>
                        </span>
                        {selectedInGroup > 0 && (
                          <span className="text-[10px] font-medium text-[var(--blue)]">{selectedInGroup} selected</span>
                        )}
                        {expanded ? (
                          <ChevronUpIcon className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>
                      {expanded &&
                        wholesaler.contacts.map((contact) => {
                          const selected = selectedContactIds.has(contact.id)
                          return (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => toggleContact(contact.id)}
                              className="flex w-full items-center gap-2.5 border-t border-slate-50 px-3 py-2.5 pl-12 text-left"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-medium text-slate-900">{contact.name}</span>
                                <span className="block truncate text-[10px] text-slate-500">{contact.email}</span>
                              </span>
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded border ${
                                  selected ? 'border-[var(--blue)] bg-[var(--blue)] text-white' : 'border-slate-300'
                                }`}
                              >
                                {selected ? '✓' : ''}
                              </span>
                            </button>
                          )
                        })}
                    </div>
                  )
                })
              )}
            </FeatureCard>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              One-off email · not saved to wholesalers
            </p>
            <div className="space-y-2">
              {oneOffRecipients.map((recipient) => (
                <FeatureCard key={recipient.id} className="flex items-center px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900">{recipient.name || 'No name'}</p>
                    <p className="text-[11px] text-slate-500">{recipient.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOneOffRecipients((prev) => prev.filter((row) => row.id !== recipient.id))}
                    className="text-slate-400"
                    aria-label={`Remove ${recipient.email}`}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </FeatureCard>
              ))}
              <FeatureCard className="space-y-2 p-3">
                <FormInput
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                  placeholder="Name (for email greeting)"
                />
                <FormInput
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addOneOff}
                    disabled={!parseOneOffRecipient(newRecipientName, newEmail)}
                    className="text-sm font-semibold text-[var(--blue)] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </FeatureCard>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <label className="flex cursor-pointer items-start justify-between gap-3">
            <span>
              <span className="block text-[13px] font-medium text-slate-900">Send Material List in Plain Text</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">
                {sendAsPlainText
                  ? 'Email will be plain text (no styled layout).'
                  : 'Email will use the styled HTML layout.'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={sendAsPlainText}
              onChange={(e) => setSendAsPlainText(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#185FA5]"
            />
          </label>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              {selectedMaterialIds.size} items · {recipientCount} recipients
            </span>
            <span className="font-medium text-[var(--blue)]">Cut-off 16:00</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={selectedMaterialIds.size === 0 || recipientCount === 0 || isSending}
              onClick={() => beginSend('quote')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--blue)] px-3 py-2.5 text-sm font-semibold text-[var(--blue)] disabled:opacity-40"
            >
              <DocumentTextIcon className="h-4 w-4" />
              Quote
            </button>
            <button
              type="button"
              disabled={selectedMaterialIds.size === 0 || recipientCount === 0 || isSending}
              onClick={() => beginSend('order')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F6E56] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {isSending ? 'Sending…' : 'Order'}
            </button>
          </div>
        </div>
      </div>

      {multiWholesalerAlert && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl">
            <p className="text-base font-semibold text-slate-900">Multiple wholesalers</p>
            <p className="mt-2 text-sm text-slate-600">{MULTIPLE_WHOLESALER_ORDER_MESSAGE}</p>
            <button
              type="button"
              onClick={() => setMultiWholesalerAlert(false)}
              className="mt-4 rounded-xl bg-[var(--blue)] px-5 py-2 text-sm font-semibold text-white"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewSection({
  title,
  items,
  excluded,
  onToggle,
}: {
  title: string
  items: ProjectMaterialLine[]
  excluded: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">Tap the red × to exclude an item from this send.</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => {
          const isExcluded = excluded.has(item.id)
          return (
            <div key={item.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${isExcluded ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  {item.material}
                </p>
                <p className="text-xs text-slate-500">{materialStatusLabel(item.status)}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className={isExcluded ? 'text-[var(--blue)]' : 'text-red-500'}
                aria-label={isExcluded ? `Include ${item.material}` : `Exclude ${item.material}`}
              >
                {isExcluded ? '+' : '×'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
