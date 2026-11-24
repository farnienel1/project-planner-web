'use client'

/**
 * Rulebook 1.83.0 §31 (web): share links through the server (`/api/compliance/share-links`), and the zip of chosen
 * documents built in the browser from each file's Storage download link (the reader is an admin: only admins can
 * read the objects). Every rule is the rulebook's (`orgComplianceZipEntryNames`, `orgComplianceZipFileName`).
 */

import { zipSync } from 'fflate'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '@/lib/firebase/config'
import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { safeExternalUrl } from '@/lib/canonical/uploadPolicy'
import {
  ORG_COMPLIANCE_ZIP_MAX_BYTES,
  ORG_COMPLIANCE_ZIP_MAX_DOCUMENTS,
  ORG_COMPLIANCE_ZIP_TOO_LARGE_MESSAGE,
  orgComplianceZipEntryNames,
  orgComplianceZipFileName,
  type OrgComplianceEntry,
} from '@/lib/canonical/orgCompliance'

export type ComplianceShareLinkRow = {
  id: string
  documents: string[]
  createdAtMs: number | null
  expiresAtMs: number | null
  openCount: number
  lastOpenedAtMs: number | null
  state: 'active' | 'expired' | 'revoked'
}

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(await jsonAuthHeaders()), ...(init.headers ?? {}) }, cache: 'no-store' })
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || 'That did not work. Try again.')
  return body
}

export function createComplianceShareLink(organizationId: string, documents: string[]) {
  return api<{ id: string; url: string; expiresAtMs: number; documentCount: number }>('/api/compliance/share-links', {
    method: 'POST',
    body: JSON.stringify({ organizationId, documents }),
  })
}

export async function listComplianceShareLinks(organizationId: string): Promise<ComplianceShareLinkRow[]> {
  const body = await api<{ links: ComplianceShareLinkRow[] }>(
    `/api/compliance/share-links?organizationId=${encodeURIComponent(organizationId)}`,
    { method: 'GET' }
  )
  return body.links ?? []
}

export function revokeComplianceShareLink(organizationId: string, id: string) {
  return api<{ ok: boolean }>('/api/compliance/share-links/revoke', { method: 'POST', body: JSON.stringify({ organizationId, id }) })
}

/** Download the chosen documents as one zip. Throws with a message when a file could not be fetched. */
export async function downloadComplianceZip(entries: OrgComplianceEntry[], todayKey: string): Promise<void> {
  if (!storage) throw new Error('File storage is not configured.')
  if (!entries.length) throw new Error('Choose at least one document.')
  if (entries.length > ORG_COMPLIANCE_ZIP_MAX_DOCUMENTS) throw new Error(`Choose up to ${ORG_COMPLIANCE_ZIP_MAX_DOCUMENTS} documents.`)
  const stated = entries.reduce((sum, entry) => sum + (Number(entry.sizeBytes) || 0), 0)
  if (stated > ORG_COMPLIANCE_ZIP_MAX_BYTES) throw new Error(ORG_COMPLIANCE_ZIP_TOO_LARGE_MESSAGE)
  const names = orgComplianceZipEntryNames(entries)
  const files: Record<string, Uint8Array> = {}
  let total = 0
  for (const [index, entry] of entries.entries()) {
    const url = safeExternalUrl(await getDownloadURL(ref(storage, entry.path)))
    if (!url) throw new Error(`${entry.title} could not be opened.`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${entry.title} could not be downloaded.`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    total += bytes.byteLength
    // The stored sizes may be missing on older entries: check what was really downloaded too.
    if (total > ORG_COMPLIANCE_ZIP_MAX_BYTES) throw new Error(ORG_COMPLIANCE_ZIP_TOO_LARGE_MESSAGE)
    files[names[index]] = bytes
  }
  // Photos and PDFs are already compressed: store them (level 0) so the zip is quick to build.
  const zipped = zipSync(files, { level: 0 })
  const blob = new Blob([zipped as BlobPart], { type: 'application/zip' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = orgComplianceZipFileName(todayKey)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 30_000)
}
