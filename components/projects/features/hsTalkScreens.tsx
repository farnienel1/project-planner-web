'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  ArrowDownTrayIcon,
  BellAlertIcon,
  EyeIcon,
  PencilSquareIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'
import type { HSToolboxIssue, HSToolboxSignature, HSToolboxTalk, User } from '@/types'
import { signedPercent } from '@/lib/healthSafety/hsTracking'
import { buildToolboxTalkPdf, isCustomUploadedTalk } from '@/lib/healthSafety/toolboxTalkPdf'
import { FeatureCard, FeatureSectionLabel } from '@/components/projects/features/featureUi'

export function HsTalkBody({
  talk,
  issue,
  signatures,
  users,
  projectLabel,
}: {
  talk: HSToolboxTalk
  issue?: HSToolboxIssue | null
  signatures?: HSToolboxSignature[]
  users?: User[]
  projectLabel?: string
}) {
  const customFile = isCustomUploadedTalk(talk) ? (talk.fileURL || '').trim() : ''
  const previewKey = [
    talk.id,
    talk.title,
    talk.purpose,
    talk.keyPoints.join('\n'),
    talk.version,
    talk.status,
    customFile,
    issue?.id || '',
    projectLabel || '',
    (signatures || [])
      .map((signature) => `${signature.id}:${signature.status}:${signature.signedAt?.getTime() || 0}`)
      .join('|'),
    (users || []).map((row) => row.id).join('|'),
  ].join('::')
  const [src, setSrc] = useState<string | null>(customFile || null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (customFile) {
      setSrc(customFile)
      setError(null)
      return
    }
    let cancelled = false
    let objectUrl = ''
    setSrc(null)
    setError(null)
    void buildToolboxTalkPdf({ talk, issue, signatures, users, projectLabel })
      .then((bytes) => {
        if (cancelled) return
        const copy = new Uint8Array(bytes)
        objectUrl = URL.createObjectURL(new Blob([copy.buffer], { type: 'application/pdf' }))
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setError('Could not open the toolbox talk PDF.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // previewKey already covers the talk, issue, signatures and people used to draw the PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, customFile])

  return (
    <div className="space-y-3" data-hs-talk-preview="pdf">
      {talk.referenceCode ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{talk.referenceCode}</p>
      ) : null}
      <p className="text-sm font-semibold text-slate-900">{talk.title}</p>
      {src ? (
        <iframe src={src} title={talk.title} className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white" />
      ) : (
        <p className="text-sm text-slate-500">{error || 'Preparing the toolbox talk PDF…'}</p>
      )}
      {customFile ? (
        <a
          href={customFile}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-semibold text-[#2F73F0] hover:underline"
        >
          Open original file
        </a>
      ) : null}
    </div>
  )
}

export function HsSignedProgress({
  signatures,
  recipientCount,
}: {
  signatures: HSToolboxSignature[]
  recipientCount: number
}) {
  const { signed, total, percent } = signedPercent(signatures, recipientCount)
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-extrabold text-[#0fae9e]">{percent}%</p>
        <p className="text-sm font-semibold text-slate-600">
          {signed}/{total} signed
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <i className="block h-full rounded-full bg-[#0fae9e]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function HsActionRow({
  icon,
  title,
  detail,
  onClick,
  disabled,
  tone = 'plain',
}: {
  icon: typeof EyeIcon
  title: string
  detail: string
  onClick: () => void
  disabled?: boolean
  tone?: 'plain' | 'primary'
}) {
  const Icon = icon
  const primary = tone === 'primary'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left disabled:opacity-50 ${
        primary
          ? 'border-[#0fae9e] bg-[#0fae9e] text-white hover:bg-[#0c9b8d]'
          : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          primary ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className={`block text-xs ${primary ? 'text-white/80' : 'text-slate-500'}`}>{detail}</span>
      </span>
    </button>
  )
}

export function HsIssueActions({
  canSign,
  canViewSigned,
  onView,
  onSign,
  onDownload,
  downloadBusy,
  pending = 0,
  reminding = false,
  onRemind,
  onAddRecipients,
}: {
  canSign: boolean
  canViewSigned: boolean
  onView: () => void
  onSign: () => void
  onDownload: () => void
  downloadBusy?: boolean
  pending?: number
  reminding?: boolean
  onRemind?: () => void
  onAddRecipients?: () => void
}) {
  return (
    <div className="space-y-2">
      <HsActionRow icon={EyeIcon} title="View TBT" detail="Open the issued talk" onClick={onView} />
      <HsActionRow
        icon={ArrowDownTrayIcon}
        title={downloadBusy ? 'Downloading…' : 'Download talk'}
        detail="Save a copy of this talk"
        onClick={onDownload}
        disabled={downloadBusy}
      />
      {canSign ? (
        <HsActionRow icon={PencilSquareIcon} title="Sign now" detail="Record your signature" onClick={onSign} tone="primary" />
      ) : canViewSigned ? (
        <HsActionRow icon={PencilSquareIcon} title="View signed talk" detail="See the copy you signed" onClick={onSign} />
      ) : null}
      {onRemind ? (
        <HsActionRow
          icon={BellAlertIcon}
          title={reminding ? 'Sending…' : 'Remind pending'}
          detail={pending === 0 ? 'Everyone has signed' : `${pending} still to sign`}
          onClick={onRemind}
          disabled={pending === 0 || reminding}
        />
      ) : null}
      {onAddRecipients ? (
        <HsActionRow
          icon={UserPlusIcon}
          title="Send to further operatives"
          detail="Add people who have not had this talk"
          onClick={onAddRecipients}
        />
      ) : null}
    </div>
  )
}

export function HsSignatureList({
  signatures,
  users,
}: {
  signatures: HSToolboxSignature[]
  users: User[]
}) {
  if (signatures.length === 0) {
    return <p className="text-sm text-slate-500">No recipients recorded yet.</p>
  }
  return (
    <ul className="space-y-1">
      {signatures.map((signature) => {
        const person = users.find((entry) => entry.id === signature.userId)
        const name = person
          ? `${person.firstName} ${person.surname}`.trim() || person.email
          : signature.userId
        return (
          <li key={signature.id} className="flex justify-between gap-3 text-xs text-slate-600">
            <span className="truncate">{name}</span>
            <span className={signature.status === 'signed' ? 'font-semibold text-green-600' : 'text-amber-600'}>
              {signature.status === 'signed' && signature.signedAt
                ? `Signed ${format(signature.signedAt, 'd MMM HH:mm')}`
                : signature.status}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function HsTrackingIssueCard({
  title,
  reference,
  issuedAt,
  weekCommencing,
  signatures,
  recipientCount,
  onOpen,
}: {
  title: string
  reference?: string
  issuedAt: Date
  weekCommencing: Date
  signatures: HSToolboxSignature[]
  recipientCount: number
  onOpen: () => void
}) {
  const { percent, signed, total } = signedPercent(signatures, recipientCount)
  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <FeatureCard className="p-4 transition hover:border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">
              {reference ? `${reference} · ` : ''}
              Issued {format(issuedAt, 'd MMM yyyy')} · W/C {format(weekCommencing, 'd MMM')}
            </p>
          </div>
          <span className="shrink-0 text-sm font-extrabold text-[#0fae9e]">{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <i className="block h-full rounded-full bg-[#0fae9e]" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          {signed}/{total} signed
        </p>
      </FeatureCard>
    </button>
  )
}

export function HsIssueDetail({
  issue,
  talk,
  signatures,
  users,
  canSign,
  canViewSigned,
  downloadError,
  reminding,
  onBack,
  onView,
  onSign,
  onDownload,
  onRemind,
  onAddRecipients,
}: {
  issue: HSToolboxIssue
  talk?: HSToolboxTalk
  signatures: HSToolboxSignature[]
  users: User[]
  canSign: boolean
  canViewSigned: boolean
  downloadError?: string | null
  reminding?: boolean
  onBack: () => void
  onView: () => void
  onSign: () => void
  onDownload: () => void
  onRemind?: () => void
  onAddRecipients?: () => void
}) {
  const pending = signatures.filter((signature) => signature.status !== 'signed').length
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="btn sm ghost">
        ← Tracking
      </button>
      <h1 className="text-lg font-extrabold text-slate-900">{talk?.title || 'Toolbox talk'}</h1>
      <p className="text-xs text-slate-500">
        {talk?.referenceCode ? `${talk.referenceCode} · ` : ''}
        Issued {format(issue.issuedAt, 'd MMM yyyy')} · W/C {format(issue.weekCommencing, 'd MMM yyyy')}
      </p>
      <HsSignedProgress signatures={signatures} recipientCount={issue.recipientUserIds.length} />
      <HsIssueActions
        canSign={canSign}
        canViewSigned={canViewSigned}
        onView={onView}
        onSign={onSign}
        onDownload={onDownload}
        pending={pending}
        reminding={reminding}
        onRemind={onRemind}
        onAddRecipients={onAddRecipients}
      />
      {downloadError ? <p className="text-sm font-semibold text-[#A32D2D]">{downloadError}</p> : null}
      <FeatureSectionLabel>Signed</FeatureSectionLabel>
      <FeatureCard className="p-4">
        <HsSignatureList signatures={signatures.filter((signature) => signature.status === 'signed')} users={users} />
      </FeatureCard>
      <FeatureSectionLabel>Pending</FeatureSectionLabel>
      <FeatureCard className="p-4">
        <HsSignatureList signatures={signatures.filter((signature) => signature.status !== 'signed')} users={users} />
      </FeatureCard>
    </div>
  )
}

export function HsSignedTalkBody({
  talk,
  issue,
  signatures,
  users,
  projectLabel,
}: {
  talk?: HSToolboxTalk
  issue?: HSToolboxIssue | null
  signatures: HSToolboxSignature[]
  users: User[]
  projectLabel?: string
}) {
  return (
    <div className="space-y-4">
      {talk ? (
        <HsTalkBody talk={talk} issue={issue} signatures={signatures} users={users} projectLabel={projectLabel} />
      ) : (
        <p className="text-sm text-slate-500">Talk details are unavailable.</p>
      )}
      <HsSignedProgress signatures={signatures} recipientCount={signatures.length} />
      <FeatureSectionLabel>Who has signed</FeatureSectionLabel>
      <HsSignatureList signatures={signatures.filter((signature) => signature.status === 'signed')} users={users} />
      <FeatureSectionLabel>Pending</FeatureSectionLabel>
      <HsSignatureList signatures={signatures.filter((signature) => signature.status !== 'signed')} users={users} />
    </div>
  )
}
