/**
 * iOS parity source: Views/MaterialsSendListSheet.swift
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */

import type { ProjectMaterialLine, Wholesaler } from '@/types'

export type MaterialSendRequestType = 'quote' | 'order'

export type OneOffRecipient = {
  id: string
  name: string
  email: string
}

export type SendListContact = {
  id?: string
  name: string
  email: string
  wholesalerName?: string
}

export function isQuotedStatus(status: string): boolean {
  const raw = status.trim().toLowerCase()
  return raw === 'sentforquote' || raw === 'sent for quote' || raw === 'quote'
}

export function isOrderedStatus(status: string): boolean {
  const raw = status.trim().toLowerCase()
  return raw === 'ordered' || raw === 'order'
}

export function isDraftStatus(status: string): boolean {
  return status.trim().toLowerCase().includes('draft') || (!isQuotedStatus(status) && !isOrderedStatus(status))
}

export function quantityLabel(unit: string, quantity: number): string {
  const raw = unit.trim() || 'Number'
  const key = raw.toLowerCase()
  const plural = Math.abs(quantity) !== 1
  if (key === 'number') return plural ? 'Numbers' : 'Number'
  if (key === 'box') return plural ? 'Boxes' : 'Box'
  if (key === 'length') return plural ? 'Lengths' : 'Length'
  if (key === 'drum') return plural ? 'Drums' : 'Drum'
  if (key === 'pallet') return plural ? 'Pallets' : 'Pallet'
  return raw
}

export function wholesalerIdsForSelectedContacts(
  wholesalers: Pick<Wholesaler, 'id' | 'contacts'>[],
  selectedContactIds: Set<string> | string[]
): string[] {
  const selected = selectedContactIds instanceof Set ? selectedContactIds : new Set(selectedContactIds)
  const ids: string[] = []
  for (const wholesaler of wholesalers) {
    if (wholesaler.contacts.some((contact) => selected.has(contact.id))) {
      ids.push(wholesaler.id)
    }
  }
  return ids
}

export function orderBlockedForMultipleWholesalers(
  requestType: MaterialSendRequestType,
  wholesalers: Pick<Wholesaler, 'id' | 'contacts'>[],
  selectedContactIds: Set<string> | string[]
): boolean {
  if (requestType !== 'order') return false
  return wholesalerIdsForSelectedContacts(wholesalers, selectedContactIds).length > 1
}

export function partitionMaterialsForResend<T extends Pick<ProjectMaterialLine, 'id' | 'status'>>(
  materials: T[],
  requestType: MaterialSendRequestType
) {
  const alreadyQuoted = materials.filter((item) => isQuotedStatus(item.status))
  const alreadyOrdered = materials.filter((item) => isOrderedStatus(item.status))
  const fresh = materials.filter((item) => !isQuotedStatus(item.status) && !isOrderedStatus(item.status))
  const needsDialog =
    requestType === 'quote' ? alreadyQuoted.length > 0 : alreadyQuoted.length > 0 || alreadyOrdered.length > 0
  return { alreadyQuoted, alreadyOrdered, fresh, needsDialog }
}

export function resendHeadline(alreadyQuotedCount: number, alreadyOrderedCount: number): string {
  const hasQuotes = alreadyQuotedCount > 0
  const hasOrders = alreadyOrderedCount > 0
  if (hasQuotes && hasOrders) return 'Some items have been quoted and some have been ordered'
  if (hasOrders) return 'Some items on this list have already been ordered'
  return 'Some items on this list have already been sent for quote'
}

export function resendSubheadline(requestType: MaterialSendRequestType): string {
  if (requestType === 'quote') {
    return 'Choose which previously sent items to include in this quote request.'
  }
  return 'Choose which previously sent items to include in this order.'
}

export function parseOneOffRecipient(name: string, email: string): OneOffRecipient | null {
  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  if (!trimmedName || !trimmedEmail.includes('@')) return null
  return {
    id: `oneoff-${trimmedEmail.toLowerCase()}`,
    name: trimmedName,
    email: trimmedEmail,
  }
}

export function buildRecipientSnapshots(
  wholesalers: Pick<Wholesaler, 'name' | 'contacts'>[],
  selectedContactIds: Set<string> | string[],
  oneOffRecipients: OneOffRecipient[]
): SendListContact[] {
  const selected = selectedContactIds instanceof Set ? selectedContactIds : new Set(selectedContactIds)
  const contacts: SendListContact[] = []
  for (const wholesaler of wholesalers) {
    for (const contact of wholesaler.contacts) {
      if (!selected.has(contact.id)) continue
      contacts.push({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        wholesalerName: wholesaler.name,
      })
    }
  }
  for (const recipient of oneOffRecipients) {
    contacts.push({
      id: recipient.id,
      name: recipient.name,
      email: recipient.email,
    })
  }
  return contacts
}

export function supplierGreeting(contactName: string, sendAsPlainText: boolean): string {
  const trimmed = contactName.trim()
  if (!trimmed) return 'there'
  if (sendAsPlainText) return trimmed
  return trimmed.split(/\s+/)[0] || trimmed
}

export const MULTIPLE_WHOLESALER_ORDER_MESSAGE = 'Orders can only go to one wholesaler at a time.'
