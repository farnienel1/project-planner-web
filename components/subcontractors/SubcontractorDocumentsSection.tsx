'use client'

/**
 * Rulebook 1.80.0 (owner decision 24 Nov, option (a)): a subcontractor's Insurance and RAMS documents, uploaded by
 * staff (`canManageSubcontractors`; the page itself already requires it). Every rule is the rulebook's
 * (`lib/canonical/subcontractorDocuments.ts`, `uploadPolicy.ts`, `storedFiles.ts`); this file only shows them.
 */

import { useRef, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '@/lib/firebase/config'
import { useToast } from '@/components/ui/ToastProvider'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { staffAccountRole } from '@/lib/permissions'
import type { User } from '@/types'
import { FILE_KEPT_ON_REMOVE_COPY, fileDeletePermission } from '@/lib/canonical/storedFiles'
import { safeExternalUrl, uploadAcceptAttribute, uploadAllowedHint } from '@/lib/canonical/uploadPolicy'
import {
  SUBCONTRACTOR_DOCUMENT_EXPIRY_LABEL,
  SUBCONTRACTOR_DOCUMENT_KINDS,
  SUBCONTRACTOR_DOCUMENT_LABELS,
  SUBCONTRACTOR_DOCUMENTS_EMPTY_TEXT,
  subcontractorDocumentExpiryError,
  subcontractorDocumentExpiryState,
  type SubcontractorDocumentEntry,
  type SubcontractorDocumentKind,
  type SubcontractorDocuments,
} from '@/lib/canonical/subcontractorDocuments'
import {
  removeSubcontractorDocument,
  setSubcontractorDocumentExpiry,
  uploadSubcontractorDocument,
} from '@/lib/subcontractors/subcontractorDocumentsWrites'

const EXPIRY_HUE: Record<string, string | undefined> = {
  expired: 'red',
  expiresToday: 'red',
  expiringSoon: 'warn',
  valid: 'green',
}

function dateText(ms: number | null, timeZone: string): string {
  if (ms == null) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms))
  } catch {
    return ''
  }
}

export function SubcontractorDocumentsSection({
  organizationId,
  subcontractorId,
  documents,
  user,
}: {
  organizationId: string
  subcontractorId: string
  documents: SubcontractorDocuments | undefined
  user: User
}) {
  return (
    <div className="stack" style={{ gap: 16, marginTop: 20 }}>
      {SUBCONTRACTOR_DOCUMENT_KINDS.map((kind) => (
        <DocumentKindBlock
          key={kind}
          kind={kind}
          organizationId={organizationId}
          subcontractorId={subcontractorId}
          entries={documents?.[kind] ?? []}
          user={user}
        />
      ))}
    </div>
  )
}

function DocumentKindBlock({
  kind,
  organizationId,
  subcontractorId,
  entries,
  user,
}: {
  kind: SubcontractorDocumentKind
  organizationId: string
  subcontractorId: string
  entries: SubcontractorDocumentEntry[]
  user: User
}) {
  const toast = useToast()
  const timeZone = useOrganizationTimeZone()
  const fileInput = useRef<HTMLInputElement>(null)
  const [expiry, setExpiry] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = SUBCONTRACTOR_DOCUMENT_LABELS[kind]
  const inputId = `sub-doc-expiry-${kind}`

  async function onPick(file: File | undefined) {
    if (!file) return
    const expiryError = subcontractorDocumentExpiryError(expiry)
    if (expiryError) {
      setError(expiryError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await uploadSubcontractorDocument({ organizationId, subcontractorId, kind, file, expiresOn: expiry || null, actorUid: user.id })
      setExpiry('')
      toast(`${label} document uploaded.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload did not finish. Try again.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function onOpen(entry: SubcontractorDocumentEntry) {
    try {
      if (!storage) throw new Error('File storage is not configured.')
      const url = safeExternalUrl(await getDownloadURL(ref(storage, entry.path)))
      if (!url) throw new Error('This file cannot be opened.')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'This file cannot be opened.')
    }
  }

  async function onRemove(entry: SubcontractorDocumentEntry) {
    // Rulebook §24: the object is deleted only when fileDeletePermission allows it; otherwise it is unlinked and kept.
    const deletion = fileDeletePermission({
      storagePath: entry.path,
      organizationId,
      viewerUserId: user.id,
      viewerRole: staffAccountRole(user),
      nowMs: Date.now(),
      uploadedAtMs: entry.uploadedAtMs,
    })
    if (!window.confirm(deletion.allowed ? `Remove ${entry.name}?` : `Remove ${entry.name} from this list? The file itself is kept.`)) return
    try {
      await removeSubcontractorDocument({ organizationId, subcontractorId, kind, entryId: entry.id, actorUid: user.id, deleteFile: deletion.allowed })
      if (!deletion.allowed) toast(FILE_KEPT_ON_REMOVE_COPY)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The document could not be removed.')
    }
  }

  async function onChangeExpiry(entry: SubcontractorDocumentEntry, value: string) {
    try {
      await setSubcontractorDocumentExpiry({ organizationId, subcontractorId, kind, entryId: entry.id, expiresOn: value || null, actorUid: user.id })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The expiry date could not be saved.')
    }
  }

  return (
    <section aria-labelledby={`sub-doc-${kind}`}>
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 id={`sub-doc-${kind}`} className="h2 grow" style={{ fontSize: 16 }}>
          {label} · {entries.length}
        </h3>
      </div>
      {entries.length === 0 ? (
        <p className="muted small">{SUBCONTRACTOR_DOCUMENTS_EMPTY_TEXT}</p>
      ) : (
        <div className="rows">
          {entries.map((entry) => {
            const state = subcontractorDocumentExpiryState(entry.expiresOn, Date.now(), timeZone)
            const uploaded = dateText(entry.uploadedAtMs, timeZone)
            return (
              <div key={entry.id} className="ritem" style={{ boxShadow: 'none', background: 'var(--soft)', cursor: 'default' }}>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="t" style={{ overflowWrap: 'anywhere' }}>{entry.name}</span>
                  <span className="s">{uploaded ? `Uploaded ${uploaded}` : 'Uploaded'}</span>
                  <label className="s" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    Expiry
                    <input
                      key={entry.expiresOn ?? 'none'}
                      type="date"
                      className="in"
                      style={{ maxWidth: 170, height: 32 }}
                      defaultValue={entry.expiresOn ?? ''}
                      aria-label={`Expiry date for ${entry.name}`}
                      onBlur={(e) => {
                        const value = e.target.value
                        if (value !== (entry.expiresOn ?? '')) void onChangeExpiry(entry, value)
                      }}
                    />
                  </label>
                </span>
                <span className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
                  <span className="pill" data-hue={EXPIRY_HUE[state.state]}>
                    {state.label}
                  </span>
                  <button type="button" className="btn sm" onClick={() => void onOpen(entry)}>
                    View
                  </button>
                  <button type="button" className="btn sm" onClick={() => void onRemove(entry)} aria-label={`Remove ${entry.name}`}>
                    Remove
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div className="row wrap" style={{ gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
        <label htmlFor={inputId} className="small" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SUBCONTRACTOR_DOCUMENT_EXPIRY_LABEL}
          <input id={inputId} type="date" className="in" style={{ maxWidth: 190 }} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
        <button type="button" className="btn sm tint" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? 'Uploading…' : `Upload ${label}`}
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept={uploadAcceptAttribute('subcontractor_document')}
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
      </div>
      <p className="muted small" style={{ marginTop: 4 }}>{uploadAllowedHint('subcontractor_document')}</p>
      {error ? (
        <p className="banner" data-hue="red" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
