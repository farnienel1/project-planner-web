'use client'

import { format } from 'date-fns'
import type { HSToolboxIssue, HSToolboxSignature, HSToolboxTalk, User } from '@/types'
import { signaturePngSrc } from '@/lib/signature/signatureImage'
import { signedPercent } from '@/lib/healthSafety/hsTracking'
import { FeatureCard, FeatureSectionLabel } from '@/components/projects/features/featureUi'
import { HsPrimaryButton, HsSectionLabel } from '@/components/projects/features/hsUi'

export function HsTalkBody({ talk }: { talk: HSToolboxTalk }) {
  return (
    <div className="space-y-3">
      {talk.referenceCode ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{talk.referenceCode}</p>
      ) : null}
      <p className="text-sm font-semibold text-slate-900">{talk.title}</p>
      {talk.purpose ? <p className="text-sm text-slate-600">{talk.purpose}</p> : null}
      {talk.keyPoints.length > 0 ? (
        <div>
          <HsSectionLabel>Key control points</HsSectionLabel>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {talk.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {talk.fileURL ? (
        <a
          href={talk.fileURL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-semibold text-[#2F73F0] hover:underline"
        >
          Open uploaded talk
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

export function HsIssueActions({
  canSign,
  canViewSigned,
  onView,
  onSign,
  onDownload,
  downloadBusy,
}: {
  canSign: boolean
  canViewSigned: boolean
  onView: () => void
  onSign: () => void
  onDownload: () => void
  downloadBusy?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <button
        type="button"
        onClick={onView}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
      >
        View TBT
      </button>
      <button
        type="button"
        onClick={onDownload}
        disabled={downloadBusy}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {downloadBusy ? 'Downloading…' : 'Download talk'}
      </button>
      {canSign ? (
        <HsPrimaryButton onClick={onSign}>Sign now</HsPrimaryButton>
      ) : canViewSigned ? (
        <button
          type="button"
          onClick={onSign}
          className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-600"
        >
          View signed talk
        </button>
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
  onBack,
  onView,
  onSign,
  onDownload,
}: {
  issue: HSToolboxIssue
  talk?: HSToolboxTalk
  signatures: HSToolboxSignature[]
  users: User[]
  canSign: boolean
  canViewSigned: boolean
  downloadError?: string | null
  onBack: () => void
  onView: () => void
  onSign: () => void
  onDownload: () => void
}) {
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
      />
      {downloadError ? <p className="text-sm font-semibold text-[#A32D2D]">{downloadError}</p> : null}
      <FeatureSectionLabel>Sign-off</FeatureSectionLabel>
      <FeatureCard className="p-4">
        <HsSignatureList signatures={signatures} users={users} />
      </FeatureCard>
    </div>
  )
}

export function HsSignedTalkBody({
  talk,
  signature,
}: {
  talk?: HSToolboxTalk
  signature?: HSToolboxSignature
}) {
  const src = signaturePngSrc(signature?.signatureImageBase64)
  return (
    <div className="space-y-4">
      {talk ? <HsTalkBody talk={talk} /> : <p className="text-sm text-slate-500">Talk details are unavailable.</p>}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your signature</p>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Signature" className="mt-2 max-h-16" />
        ) : (
          <p className="mt-2 text-sm text-slate-500">Signed</p>
        )}
        {signature?.signedAt ? (
          <p className="mt-1 text-xs text-slate-500">{format(signature.signedAt, "d MMM yyyy 'at' HH:mm")}</p>
        ) : null}
      </div>
    </div>
  )
}
