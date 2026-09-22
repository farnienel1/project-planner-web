/**
 * iOS parity source: Views/MaterialsSendListSheet.swift
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
import { useWholesalerStore } from '@/lib/stores/wholesalerStore'
import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { formatSiteAddress } from '@/lib/maps/siteAddress'
import { materialStatusLabel } from '@/lib/maps/siteLocation'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { FormInput } from '@/components/forms/FormShell'
import { FeatureCard, StatusPill, materialStatusTone } from '@/components/projects/features/featureUi'
import { useToast } from '@/components/ui/ToastProvider'
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
import {
  buildMaterialWhatsAppMessage,
  openWhatsAppClickToChat,
  toWhatsAppDigits,
} from '@/lib/materials/whatsappOrder'
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
  const { saveWholesaler } = useWholesalerStore()
  const toast = useToast()

  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [oneOffRecipients, setOneOffRecipients] = useState<OneOffRecipient[]>([])
  const [newRecipientName, setNewRecipientName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
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
  const [countryCode, setCountryCode] = useState('GB')
  const [whatsAppOpen, setWhatsAppOpen] = useState(false)
  const [whatsAppType, setWhatsAppType] = useState<MaterialSendRequestType>('order')
  const [whatsAppRecipientId, setWhatsAppRecipientId] = useState('')
  const [whatsAppPhone, setWhatsAppPhone] = useState('')
  const [whatsAppCopyHint, setWhatsAppCopyHint] = useState<string | null>(null)
  const [savingContactPhone, setSavingContactPhone] = useState(false)

  useEffect(() => {
    setSelectedMaterialIds(new Set(materials.map((item) => item.id)))
  }, [materials])

  useEffect(() => {
    if (!organization?.id) return
    void loadOrganizationDetails(organization.id).then((details) => {
      if (details?.countryCode) setCountryCode(details.countryCode)
    })
  }, [organization?.id])

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
    const parsed = parseOneOffRecipient(newRecipientName, newEmail, newPhone)
    if (!parsed) return
    setOneOffRecipients((prev) => [...prev.filter((row) => row.email.toLowerCase() !== parsed.email.toLowerCase()), parsed])
    setNewRecipientName('')
    setNewEmail('')
    setNewPhone('')
  }

  const whatsAppRecipients = useMemo(
    () => buildRecipientSnapshots(wholesalers, selectedContactIds, oneOffRecipients),
    [wholesalers, selectedContactIds, oneOffRecipients]
  )

  const activeWhatsAppRecipient =
    whatsAppRecipients.find((row) => (row.id || row.email) === whatsAppRecipientId) || whatsAppRecipients[0] || null

  const whatsAppMessage = useMemo(() => {
    if (!whatsAppOpen) return ''
    const senderName = `${user?.firstName || ''} ${user?.surname || ''}`.trim() || user?.email || ''
    return buildMaterialWhatsAppMessage({
      requestType: whatsAppType,
      organisationName: organization?.name || '',
      requestingUserName: senderName,
      contactName: activeWhatsAppRecipient?.name || '',
      supplierName: activeWhatsAppRecipient?.wholesalerName,
      jobNumber: project.jobNumber,
      projectName: project.siteName,
      projectAddress: siteAddress,
      deliveryDate: materialsDay,
      materials: selectedMaterials.map((item) => ({
        material: item.material,
        quantity: item.quantity,
        unit: item.unit,
        brand: item.brand,
        productCode: item.productCode,
        notes: item.notes,
        lengthDisplay: [item.length, item.lengthUnit].filter(Boolean).join(' ') || undefined,
      })),
    })
  }, [
    whatsAppOpen,
    whatsAppType,
    user,
    organization?.name,
    activeWhatsAppRecipient,
    project.jobNumber,
    project.siteName,
    siteAddress,
    materialsDay,
    selectedMaterials,
  ])

  const whatsAppNumber = toWhatsAppDigits(whatsAppPhone, countryCode)

  const beginWhatsApp = () => {
    if (selectedMaterials.length === 0) return
    if (whatsAppRecipients.length === 0) {
      setError('Select a wholesaler contact or add a one-off recipient first.')
      return
    }
    const first = whatsAppRecipients[0]
    setError(null)
    setWhatsAppCopyHint(null)
    setWhatsAppType('order')
    setWhatsAppRecipientId(first.id || first.email)
    setWhatsAppPhone(first.phone || '')
    setWhatsAppOpen(true)
  }

  const copyWhatsAppMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsAppMessage)
      toast('Message copied. Paste it into WhatsApp yourself.')
      setWhatsAppCopyHint('Message copied.')
    } catch {
      setWhatsAppCopyHint('Could not copy. Select the message and copy it manually.')
    }
  }

  const openPreparedWhatsApp = () => {
    if (!whatsAppNumber.ok) {
      setWhatsAppCopyHint(whatsAppNumber.reason)
      return
    }
    const result = openWhatsAppClickToChat(whatsAppNumber.digits, whatsAppMessage)
    if (result.opened) {
      toast('WhatsApp opened with your order message prepared.')
      setWhatsAppCopyHint('WhatsApp opened with your order message prepared. Press Send in WhatsApp yourself — this does not mark the order as sent.')
    } else {
      setWhatsAppCopyHint('Unable to open WhatsApp. Copy the message and paste it there.')
    }
  }

  const saveMobileToContact = async () => {
    if (!organization?.id || !activeWhatsAppRecipient?.wholesalerId || !activeWhatsAppRecipient.id) return
    const wholesaler = wholesalers.find((row) => row.id === activeWhatsAppRecipient.wholesalerId)
    if (!wholesaler) return
    setSavingContactPhone(true)
    try {
      await saveWholesaler(organization.id, {
        ...wholesaler,
        contacts: wholesaler.contacts.map((contact) =>
          contact.id === activeWhatsAppRecipient.id ? { ...contact, phone: whatsAppPhone.trim() } : contact
        ),
        updatedAt: new Date(),
      })
      toast('Mobile number saved to this contact.')
    } catch (err: unknown) {
      setWhatsAppCopyHint(err instanceof Error ? err.message : 'Could not save the mobile number.')
    } finally {
      setSavingContactPhone(false)
    }
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
                                <span className="block truncate text-[10px] text-slate-500">
                                  {contact.phone || 'No mobile number'}
                                </span>
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
                    {recipient.phone ? <p className="text-[11px] text-slate-500">{recipient.phone}</p> : null}
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
                <FormInput
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Mobile (for WhatsApp)"
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
          <button
            type="button"
            disabled={selectedMaterialIds.size === 0 || isSending}
            onClick={beginWhatsApp}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <WhatsAppGlyph className="h-4 w-4" />
            Send via WhatsApp
          </button>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Opens WhatsApp with the message prepared. You press Send there — this does not mark the list as sent.
          </p>
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

      {whatsAppOpen && (
        <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <button type="button" className="text-sm font-medium text-[var(--blue)]" onClick={() => setWhatsAppOpen(false)}>
                Cancel
              </button>
              <p className="text-sm font-semibold text-slate-900">WhatsApp message</p>
              <span className="w-14" />
            </header>
            <div className="space-y-3 overflow-y-auto p-5">
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {(['order', 'quote'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setWhatsAppType(type)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      whatsAppType === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {type === 'order' ? 'Order' : 'Quote request'}
                  </button>
                ))}
              </div>
              {whatsAppRecipients.length > 1 ? (
                <label className="block text-xs font-medium text-slate-600">
                  To
                  <select
                    value={whatsAppRecipientId}
                    onChange={(event) => {
                      const next = whatsAppRecipients.find((row) => (row.id || row.email) === event.target.value)
                      setWhatsAppRecipientId(event.target.value)
                      setWhatsAppPhone(next?.phone || '')
                      setWhatsAppCopyHint(null)
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  >
                    {whatsAppRecipients.map((row) => (
                      <option key={row.id || row.email} value={row.id || row.email}>
                        {row.name}
                        {row.wholesalerName ? ` · ${row.wholesalerName}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">To</p>
                  <p className="text-sm font-semibold text-slate-900">{activeWhatsAppRecipient?.name || 'No contact'}</p>
                  {activeWhatsAppRecipient?.wholesalerName ? (
                    <p className="text-xs text-slate-500">{activeWhatsAppRecipient.wholesalerName}</p>
                  ) : null}
                </div>
              )}
              <label className="block text-xs font-medium text-slate-600">
                Mobile
                <FormInput
                  type="tel"
                  value={whatsAppPhone}
                  onChange={(e) => {
                    setWhatsAppPhone(e.target.value)
                    setWhatsAppCopyHint(null)
                  }}
                  placeholder="07700 900123 or +353…"
                />
              </label>
              {!whatsAppNumber.ok ? (
                <p className="text-xs text-red-600">
                  {whatsAppNumber.reason}{' '}
                  {activeWhatsAppRecipient?.wholesalerId ? (
                    <Link href={`/dashboard/wholesalers/${activeWhatsAppRecipient.wholesalerId}`} className="font-semibold text-[var(--blue)]">
                      Add mobile number
                    </Link>
                  ) : null}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">WhatsApp will open a chat with +{whatsAppNumber.digits}</p>
              )}
              {activeWhatsAppRecipient?.wholesalerId &&
              whatsAppPhone.trim() &&
              whatsAppPhone.trim() !== (activeWhatsAppRecipient.phone || '').trim() ? (
                <button
                  type="button"
                  disabled={savingContactPhone}
                  onClick={() => void saveMobileToContact()}
                  className="text-xs font-semibold text-[var(--blue)] disabled:opacity-40"
                >
                  {savingContactPhone ? 'Saving…' : 'Save mobile to this contact'}
                </button>
              ) : null}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Message</p>
                <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[13px] leading-5 text-slate-800">
                  {whatsAppMessage}
                </pre>
              </div>
              {whatsAppCopyHint ? <p className="text-xs text-slate-600">{whatsAppCopyHint}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => void copyWhatsAppMessage()}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                Copy message
              </button>
              <button
                type="button"
                disabled={!whatsAppNumber.ok}
                onClick={openPreparedWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                <WhatsAppGlyph className="h-4 w-4" />
                Open WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.43 2.13 11.9c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.43 9.91-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm.01 1.67c4.54 0 8.23 3.69 8.23 8.23 0 4.54-3.69 8.23-8.23 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.32a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.69-8.23 8.24-8.23zm4.52 11.64c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74 2.47 1.07 2.47.71 2.92.68.45-.04 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29z"
      />
    </svg>
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
