/**
 * iOS parity source: Views/ProjectHealthSafetyView.swift
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { format, startOfWeek } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHealthSafetyStore } from '@/lib/stores/healthSafetyStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { uploadFile as uploadHsFile, healthSafetyFilePath } from '@/lib/firebase/storageUtils'
import { withTimeout } from '@/lib/client/withTimeout'
import { loadPlatformToolboxLibrary, mergeToolboxTalkLibraries } from '@/lib/healthSafety/toolboxLibrary'
import { buildToolboxTalkPdfHtml, downloadHtmlFile, openToolboxTalkPdf } from '@/lib/healthSafety/toolboxTalkPdf'
import {
  findTalkForIssue,
  issueSignatures,
  talkDownloadName,
  trackingAwaitingCount,
} from '@/lib/healthSafety/hsTracking'
import {
  HsIssueDetail,
  HsSignedTalkBody,
  HsTalkBody,
  HsTrackingIssueCard,
} from '@/components/projects/features/hsTalkScreens'
import {
  combineLocalDateAndTime,
  defaultScheduleDate,
  defaultScheduleTime,
  filterToolboxTalks,
  groupTalksByCategory,
  nextRamsVersion,
  recipientsWithIssuer,
  talkTradeFilters,
} from '@/lib/healthSafety/hsTalks'
import { isHsRecipient } from '@/lib/healthSafety/hsPeople'
import { STAFF_TRADE_PRESETS } from '@/lib/staff/staffTradeTypes'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { FormInput } from '@/components/forms/FormShell'
import type { HSToolboxIssue, HSToolboxTalk, Project } from '@/types'
import {
  DocListRow,
  FeatureCard,
  FeatureScreen,
  FeatureSectionLabel,
  HubCard,
} from '@/components/projects/features/featureUi'
import {
  HsChipRow,
  HsFieldCard,
  HsFileButton,
  HsHero,
  HsPrimaryButton,
  HsRecipientPicker,
  HsSearchField,
  HsSectionLabel,
  HsSheet,
  HsTalkPicker,
} from '@/components/projects/features/hsUi'

type ManagerTab = 'hub' | 'library' | 'tracking' | 'rams' | 'other'

const RAMS_TRADES = ['General', ...STAFF_TRADE_PRESETS]

function projectIdsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function HubActionRow({
  title,
  subtitle,
  onClick,
}: {
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-200"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f0ff] text-[#2f73f0]">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export function ProjectHealthSafetySection({
  project,
  isSmallWorks,
}: {
  project: Project
  isSmallWorks: boolean
}) {
  const { organization, user } = useAuthStore()
  const { data, loading, error, load, save, issueToolboxTalk, signToolboxTalk, addToolboxTalk, remindPending, addRecipients } =
    useHealthSafetyStore()
  const { users, loadUsers } = useOrgUserStore()

  const isManager = !isOperativeMode(user)
  const [tab, setTab] = useState<ManagerTab>('hub')
  const [talkSearch, setTalkSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')

  const [showIssue, setShowIssue] = useState(false)
  const [issueTalkId, setIssueTalkId] = useState('')
  const [issueRecipients, setIssueRecipients] = useState<string[]>([])
  const [signAsIssuer, setSignAsIssuer] = useState(true)
  const [scheduleSignAsIssuer, setScheduleSignAsIssuer] = useState(true)
  const [openLibraryCategories, setOpenLibraryCategories] = useState<string[]>(['General'])
  const [showUploadTalk, setShowUploadTalk] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadPurpose, setUploadPurpose] = useState('')
  const [uploadCategory, setUploadCategory] = useState('general')
  const [uploadTrades, setUploadTrades] = useState<string[]>([])
  const [uploadIsGeneral, setUploadIsGeneral] = useState(true)
  const [uploadKeyPoints, setUploadKeyPoints] = useState<string[]>([''])
  const [uploadTalkFile, setUploadTalkFile] = useState<File | null>(null)
  const [showScheduled, setShowScheduled] = useState(false)
  const [showAddRams, setShowAddRams] = useState(false)
  const [showAddOther, setShowAddOther] = useState(false)
  const [signIssue, setSignIssue] = useState<HSToolboxIssue | null>(null)
  const [trackIssue, setTrackIssue] = useState<HSToolboxIssue | null>(null)
  const [viewTalk, setViewTalk] = useState<HSToolboxTalk | null>(null)
  const [viewSignedIssue, setViewSignedIssue] = useState<HSToolboxIssue | null>(null)
  const [signatureB64, setSignatureB64] = useState<string | null>(null)
  const [readConfirmed, setReadConfirmed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [ramsTitle, setRamsTitle] = useState('')
  const [ramsTrade, setRamsTrade] = useState('General')
  const [ramsFile, setRamsFile] = useState<File | null>(null)
  const [otherTitle, setOtherTitle] = useState('')
  const [otherTrade, setOtherTrade] = useState('General')
  const [otherFile, setOtherFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extraRecipients, setExtraRecipients] = useState<string[]>([])
  const [showAddRecipients, setShowAddRecipients] = useState(false)
  const [reminding, setReminding] = useState(false)

  const [scheduleTalkId, setScheduleTalkId] = useState('')
  const [scheduleRecipients, setScheduleRecipients] = useState<string[]>([])
  const [scheduleDate, setScheduleDate] = useState(defaultScheduleDate)
  const [scheduleTime, setScheduleTime] = useState(defaultScheduleTime)
  const [platformTalks, setPlatformTalks] = useState<HSToolboxTalk[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)

  const bannerGradient = isOperativeMode(user)
    ? 'bg-gradient-to-br from-[#19c4b3] to-[#0fae9e]'
    : 'bg-gradient-to-br from-[#3f86ff] to-[#2563eb]'

  useEffect(() => {
    if (organization?.id) {
      load(organization.id, project.id, isSmallWorks)
      loadUsers(organization.id)
    }
  }, [organization, project.id, isSmallWorks, load, loadUsers])

  useEffect(() => {
    setLibraryLoading(true)
    loadPlatformToolboxLibrary()
      .then(setPlatformTalks)
      .catch(() => setPlatformTalks([]))
      .finally(() => setLibraryLoading(false))
  }, [])

  const libraryTalks = useMemo(
    () => mergeToolboxTalkLibraries(platformTalks, data?.talks || []),
    [platformTalks, data?.talks]
  )

  const projectIssues = useMemo(
    () => (data?.issues || []).filter((i) => projectIdsMatch(i.projectId, project.id)),
    [data?.issues, project.id]
  )

  const scheduledIssues = useMemo(() => {
    const now = Date.now()
    return projectIssues.filter((i) => i.publishAt && i.publishAt.getTime() > now)
  }, [projectIssues])

  const activeIssues = useMemo(() => {
    const now = Date.now()
    return projectIssues.filter((i) => !i.publishAt || i.publishAt.getTime() <= now)
  }, [projectIssues])

  const userAliasIds = useMemo(() => {
    if (!user) return [] as string[]
    const email = user.email.trim().toLowerCase()
    const ids = new Set<string>([user.id])
    for (const row of users) {
      if (row.email.trim().toLowerCase() === email) ids.add(row.id)
    }
    return [...ids]
  }, [user, users])

  const myAssigned = useMemo(() => {
    if (!user || !data) return []
    return data.signatures
      .filter((sig) => userAliasIds.includes(sig.userId))
      .map((sig) => {
        const issue = data.issues.find((i) => i.id === sig.issueId)
        if (!issue || !projectIdsMatch(issue.projectId, project.id)) return null
        if (issue.publishAt && issue.publishAt.getTime() > Date.now()) return null
        return {
          issue,
          signature: sig,
          talk: findTalkForIssue(issue, libraryTalks, data.talks),
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
  }, [data, user, project.id, libraryTalks, userAliasIds])

  const filteredTalks = useMemo(
    () => filterToolboxTalks(libraryTalks, talkSearch, tradeFilter),
    [libraryTalks, talkSearch, tradeFilter]
  )

  const libraryGroups = useMemo(() => groupTalksByCategory(filteredTalks), [filteredTalks])

  const tradeFilters = useMemo(() => talkTradeFilters(libraryTalks), [libraryTalks])

  const operativeUsers = useMemo(() => users.filter(isHsRecipient), [users])

  const schedulePublishAt = useMemo(
    () => combineLocalDateAndTime(scheduleDate, scheduleTime),
    [scheduleDate, scheduleTime]
  )

  const awaitingSignatures = useMemo(
    () => trackingAwaitingCount(activeIssues, data?.signatures || []),
    [activeIssues, data?.signatures]
  )

  const pendingForCurrentUser = (signatures: { userId: string; status: string }[]) =>
    signatures.find((signature) => userAliasIds.includes(signature.userId) && signature.status !== 'signed')

  const signedForCurrentUser = (signatures: { userId: string; status: string }[]) =>
    signatures.find((signature) => userAliasIds.includes(signature.userId) && signature.status === 'signed')

  const selectedIssueTalk = libraryTalks.find((talk) => talk.id === issueTalkId)
  const selectedScheduleTalk = libraryTalks.find((talk) => talk.id === scheduleTalkId)
  const signTalk =
    signIssue &&
    (libraryTalks.find((talk) => talk.id === signIssue.talkId) || data?.talks.find((talk) => talk.id === signIssue.talkId))

  const ensureTalkOnProject = async (talkId: string) => {
    if (!organization?.id) return
    const selectedTalk = libraryTalks.find((talk) => talk.id === talkId)
    if (selectedTalk && !data?.talks.some((talk) => talk.id === selectedTalk.id)) {
      await addToolboxTalk(organization.id, project.id, isSmallWorks, selectedTalk)
    }
  }

  const submitIssue = async () => {
    if (!organization?.id || !user || !issueTalkId) return
    const recipients = recipientsWithIssuer(issueRecipients, user.id, signAsIssuer)
    if (recipients.length === 0) return
    await ensureTalkOnProject(issueTalkId)
    await issueToolboxTalk(organization.id, project.id, isSmallWorks, issueTalkId, recipients, user.id, {
      weekCommencing: startOfWeek(new Date(), { weekStartsOn: 1 }),
    })
    setShowIssue(false)
    setIssueTalkId('')
    setIssueRecipients([])
    setSignAsIssuer(true)
  }

  const submitSchedule = async () => {
    if (!organization?.id || !user || !scheduleTalkId || !schedulePublishAt) return
    const recipients = recipientsWithIssuer(scheduleRecipients, user.id, scheduleSignAsIssuer)
    if (recipients.length === 0) return
    await ensureTalkOnProject(scheduleTalkId)
    await issueToolboxTalk(organization.id, project.id, isSmallWorks, scheduleTalkId, recipients, user.id, {
      weekCommencing: startOfWeek(schedulePublishAt, { weekStartsOn: 1 }),
      publishAt: schedulePublishAt,
    })
    setScheduleTalkId('')
    setScheduleRecipients([])
    setScheduleSignAsIssuer(true)
    setScheduleDate(defaultScheduleDate())
    setScheduleTime(defaultScheduleTime())
  }

  const submitUploadTalk = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !uploadTitle.trim()) return
    setUploading(true)
    setUploadError(null)
    try {
      let fileURL: string | undefined
      if (uploadTalkFile) {
        const path = healthSafetyFilePath(organization.id, project.id, 'talks', uploadTalkFile.name)
        fileURL = await withTimeout(
          uploadHsFile(path, uploadTalkFile, uploadTalkFile.type || 'application/octet-stream'),
          45_000,
          'Talk file upload timed out. Try a smaller PDF.'
        )
      }
      await addToolboxTalk(organization.id, project.id, isSmallWorks, {
        title: uploadTitle.trim(),
        category: uploadCategory.trim() || 'general',
        isGeneral: uploadIsGeneral || uploadTrades.length === 0,
        trades: uploadIsGeneral ? [] : uploadTrades,
        purpose: uploadPurpose.trim(),
        keyPoints: uploadKeyPoints.map((point) => point.trim()).filter(Boolean),
        source: 'uploaded',
        status: 'approved',
        version: 1,
        fileURL,
      })
      setShowUploadTalk(false)
      setUploadTitle('')
      setUploadPurpose('')
      setUploadCategory('general')
      setUploadTrades([])
      setUploadIsGeneral(true)
      setUploadKeyPoints([''])
      setUploadTalkFile(null)
      setTab('library')
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Could not save toolbox talk')
    } finally {
      setUploading(false)
    }
  }

  const submitSign = async () => {
    if (!organization?.id || !user || !signIssue || !signatureB64 || !readConfirmed) return
    setSigning(true)
    setUploadError(null)
    try {
      const aliasUserIds = users
        .filter((row) => row.email.trim().toLowerCase() === user.email.trim().toLowerCase())
        .map((row) => row.id)
      await signToolboxTalk(
        organization.id,
        project.id,
        isSmallWorks,
        signIssue.id,
        user.id,
        signatureB64,
        aliasUserIds
      )
      setSignIssue(null)
      setSignatureB64(null)
      setReadConfirmed(false)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Could not save signature')
    } finally {
      setSigning(false)
    }
  }

  const addRams = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !data || !ramsTitle.trim()) return
    setUploading(true)
    setUploadError(null)
    try {
      let fileURL: string | undefined
      if (ramsFile) {
        const path = healthSafetyFilePath(organization.id, project.id, 'rams', ramsFile.name)
        fileURL = await withTimeout(
          uploadHsFile(path, ramsFile, ramsFile.type || 'application/octet-stream'),
          45_000,
          'RAMS upload timed out. Try a smaller PDF.'
        )
      }
      const version = nextRamsVersion(data.ramsDocuments, ramsTitle)
      await save(organization.id, project.id, isSmallWorks, {
        ...data,
        ramsDocuments: [
          {
            id: newUuid(),
            title: ramsTitle.trim(),
            trade: ramsTrade,
            version,
            status: 'Active',
            uploadedAt: new Date(),
            fileURL,
            fileName: ramsFile?.name,
          },
          ...data.ramsDocuments,
        ],
      })
      setRamsTitle('')
      setRamsFile(null)
      setShowAddRams(false)
      setTab('rams')
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload RAMS')
    } finally {
      setUploading(false)
    }
  }

  const addOther = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !data || !otherTitle.trim()) return
    setUploading(true)
    setUploadError(null)
    try {
      let fileURL: string | undefined
      if (otherFile) {
        const path = healthSafetyFilePath(organization.id, project.id, 'other', otherFile.name)
        fileURL = await withTimeout(
          uploadHsFile(path, otherFile, otherFile.type || 'application/octet-stream'),
          45_000,
          'Document upload timed out. Try a smaller PDF.'
        )
      }
      await save(organization.id, project.id, isSmallWorks, {
        ...data,
        otherDocuments: [
          {
            id: newUuid(),
            title: otherTitle.trim(),
            trade: otherTrade,
            category: 'Trade',
            uploadedAt: new Date(),
            fileURL,
            fileName: otherFile?.name,
          },
          ...data.otherDocuments,
        ],
      })
      setOtherTitle('')
      setOtherFile(null)
      setShowAddOther(false)
      setTab('other')
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Could not add document')
    } finally {
      setUploading(false)
    }
  }

  const resolveTalk = (issue: HSToolboxIssue) =>
    findTalkForIssue(issue, libraryTalks, data?.talks || [])

  const handleDownloadTalk = (talk: HSToolboxTalk | undefined, issue?: HSToolboxIssue) => {
    setDownloadError(null)
    if (!talk) {
      setDownloadError('This toolbox talk could not be loaded.')
      return
    }
    if (!organization) {
      setDownloadError('Organisation is required to generate the talk.')
      return
    }
    const html = buildToolboxTalkPdfHtml({
      talk,
      issue: issue || {
        id: talk.id,
        projectId: project.id,
        talkId: talk.id,
        weekCommencing: startOfWeek(new Date(), { weekStartsOn: 1 }),
        issuedByUserId: user?.id || '',
        issuedAt: new Date(),
        recipientUserIds: [],
        status: 'issued',
      },
      signatures: issue ? issueSignatures(data?.signatures || [], issue.id) : [],
      users,
      project,
      organizationName: organization.name || 'Organisation',
      presentedBy: `${user?.firstName || ''} ${user?.surname || ''}`.trim() || organization.name || 'Project Planner',
    })
    const filename = `${talkDownloadName(talk)}${issue ? `-${issue.id.slice(0, 8)}` : ''}.html`
    const result = openToolboxTalkPdf(html, filename)
    if (!result.printed) downloadHtmlFile(html, filename)
  }

  const openSign = (issue: HSToolboxIssue) => {
    setSignatureB64(null)
    setReadConfirmed(false)
    setSignIssue(issue)
  }

  const toggleUploadTrade = (trade: string) => {
    setUploadIsGeneral(false)
    setUploadTrades((prev) => (prev.includes(trade) ? prev.filter((item) => item !== trade) : [...prev, trade]))
  }

  const managerTabs: { id: ManagerTab; label: string }[] = isManager
    ? [
        { id: 'hub', label: 'Hub' },
        { id: 'library', label: 'Library' },
        { id: 'tracking', label: 'Tracking' },
        { id: 'rams', label: 'RAMS' },
        { id: 'other', label: 'Other' },
      ]
    : [
        { id: 'hub', label: 'Toolbox' },
        { id: 'rams', label: 'RAMS' },
        { id: 'other', label: 'Other' },
      ]

  if (loading && !data) return <LoadingSpinner />
  if (!data) return <EmptyState title="H&S unavailable" description="Could not load health & safety data." />

  return (
    <FeatureScreen>
      {(error || uploadError) && (
        <div className="mb-4">
          <ErrorBanner message={error || uploadError || ''} />
        </div>
      )}

      {!(tab === 'tracking' && trackIssue) && (
      <div className={`mb-4 flex items-center gap-3.5 rounded-[20px] px-4 py-4 text-white shadow-lg ${bannerGradient}`}>
        <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white/20">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold">Health &amp; Safety</p>
          <p className="text-xs opacity-90">
            {project.jobNumber} · {project.siteName}
          </p>
        </div>
      </div>
      )}
      {!(tab === 'tracking' && trackIssue) && (
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-[13px] bg-[#e7ebf1] p-1">
        {managerTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTrackIssue(null)
              setTab(item.id)
            }}
            className={`min-w-[72px] flex-1 rounded-[10px] py-2 text-xs font-bold transition-colors ${
              tab === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      )}

      {tab === 'hub' && (
        <div className="space-y-4">
          {isManager && (
            <div className="rounded-2xl bg-[var(--blue-t)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--blue)]">Manager access</p>
              <p className="text-xs text-[var(--blue)]/80">Add, edit, issue &amp; track all H&amp;S records</p>
            </div>
          )}
          {myAssigned.length > 0 && (
            <div>
              <FeatureSectionLabel>My toolbox talks</FeatureSectionLabel>
              <div className="space-y-2">
                {myAssigned.map(({ issue, signature, talk }) => {
                  const pending = signature.status !== 'signed'
                  return (
                    <FeatureCard key={issue.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{talk?.title || 'Toolbox talk'}</p>
                        <p className="text-xs text-slate-500">W/C {format(issue.weekCommencing, 'd MMM yyyy')}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setViewTalk(
                              talk || {
                                id: issue.talkId,
                                title: 'Toolbox talk',
                                category: 'general',
                                isGeneral: true,
                                trades: [],
                                purpose: '',
                                keyPoints: [],
                                source: 'library',
                                status: 'approved',
                                version: 1,
                                updatedAt: new Date(),
                              }
                            )
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (pending) openSign(issue)
                            else setViewSignedIssue(issue)
                          }}
                          className={`rounded-xl px-3 py-2 text-xs font-bold ${
                            pending ? 'bg-[#0fae9e] text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {pending ? 'Sign now' : 'Signed'}
                        </button>
                      </div>
                    </FeatureCard>
                  )
                })}
              </div>
            </div>
          )}

          {isManager && (
            <>
              <FeatureSectionLabel>{isSmallWorks ? 'This small work' : 'This project'}</FeatureSectionLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <FeatureCard className="p-3 text-center">
                  <p className="text-xl font-extrabold text-slate-900">{activeIssues.length}</p>
                  <p className="text-[10px] text-slate-500">Talks issued</p>
                </FeatureCard>
                <FeatureCard className="p-3 text-center">
                  <p className="text-xl font-extrabold text-slate-900">
                    {awaitingSignatures}
                  </p>
                  <p className="text-[10px] text-slate-500">Awaiting signatures</p>
                </FeatureCard>
                <FeatureCard className="p-3 text-center">
                  <p className="text-xl font-extrabold text-slate-900">{data.ramsDocuments.length}</p>
                  <p className="text-[10px] text-slate-500">RAMS documents</p>
                </FeatureCard>
                <FeatureCard className="p-3 text-center">
                  <p className="text-xl font-extrabold text-slate-900">{scheduledIssues.length}</p>
                  <p className="text-[10px] text-slate-500">Scheduled talks</p>
                </FeatureCard>
              </div>

              <FeatureSectionLabel>Quick actions</FeatureSectionLabel>
              <div className="space-y-2">
                <HubActionRow
                  title="Issue a toolbox talk"
                  subtitle="Open the library and pick a talk"
                  onClick={() => setTab('library')}
                />
                <HubActionRow
                  title="Upload a toolbox talk"
                  subtitle="Add your own talk to the library"
                  onClick={() => {
                    setTab('library')
                    setShowUploadTalk(true)
                  }}
                />
                <HubActionRow
                  title="Upload RAMS"
                  subtitle="Risk assessment and method statement"
                  onClick={() => {
                    setTab('rams')
                    setShowAddRams(true)
                  }}
                />
                <HubActionRow
                  title="Add H&S document"
                  subtitle="Policies, COSHH, permits and more"
                  onClick={() => {
                    setTab('other')
                    setShowAddOther(true)
                  }}
                />
                <HubActionRow
                  title="Schedule toolbox talk"
                  subtitle="Pick a talk, date, time and recipients"
                  onClick={() => setShowScheduled(true)}
                />
              </div>

              <FeatureSectionLabel>Browse</FeatureSectionLabel>
              <HubCard
                title="Toolbox library"
                subtitle="Search and issue talks"
                count={libraryTalks.length}
                countLabel="in library"
                iconBg="bg-[#e6f7f6]"
                iconColor="text-[#0fae9e]"
                iconPath="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                onClick={() => setTab('library')}
              />
              <HubCard
                title="Tracking"
                subtitle="Signature progress by issue"
                count={awaitingSignatures}
                countLabel="awaiting"
                iconBg="bg-[#fdf2e0]"
                iconColor="text-[#e08a1e]"
                iconPath="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                onClick={() => setTab('tracking')}
              />
            </>
          )}

          {!isManager && myAssigned.length === 0 && (
            <EmptyState title="Nothing to sign" description="Toolbox talks issued to you will appear here." />
          )}
        </div>
      )}

      {tab === 'library' && isManager && (
        <div className="space-y-3">
          <HsSearchField value={talkSearch} onChange={setTalkSearch} placeholder="Search toolbox talks" />
          <HsChipRow chips={tradeFilters} selected={tradeFilter} onSelect={setTradeFilter} />
          <p className="px-1 text-[11px] text-slate-500">
            {libraryLoading ? 'Loading library…' : `${filteredTalks.length} talks · ${libraryTalks.length} in the master library`}
          </p>
          <button
            type="button"
            onClick={() => setShowUploadTalk(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#2f73f0]/40 bg-[#e8f0ff] py-2.5 text-sm font-semibold text-[#2f73f0]"
          >
            + Upload custom talk
          </button>
          {libraryLoading ? (
            <LoadingSpinner label="Loading toolbox library…" />
          ) : filteredTalks.length === 0 ? (
            <EmptyState title="No talks found" description="Search the library or upload a custom talk." />
          ) : (
            <FeatureCard>
              {libraryGroups.map((group) => {
                const open =
                  talkSearch.trim().length > 0 ||
                  tradeFilter === group.category ||
                  openLibraryCategories.includes(group.category)
                return (
                  <div key={group.category} className="border-t border-[#EEF1F5] first:border-t-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenLibraryCategories((current) =>
                          current.includes(group.category)
                            ? current.filter((item) => item !== group.category)
                            : [...current, group.category]
                        )
                      }
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                    >
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{group.category}</span>
                      <span className="text-xs font-semibold text-slate-400">
                        {group.talks.length}
                        {open ? ' · hide' : ' · show'}
                      </span>
                    </button>
                    {open
                      ? group.talks.map((talk: HSToolboxTalk) => (
                          <div
                            key={talk.id}
                            className="flex items-center justify-between gap-2 border-t border-[#EEF1F5] px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{talk.title}</p>
                              <p className="text-xs text-slate-500">
                                {talk.referenceCode ? `${talk.referenceCode} · ` : ''}
                                {talk.category}
                                {talk.trades.length > 0 ? ` · ${talk.trades.join(', ')}` : ' · General'}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setViewTalk(talk)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIssueTalkId(talk.id)
                                  setSignAsIssuer(true)
                                  setShowIssue(true)
                                }}
                                className="rounded-lg bg-[#2f73f0] px-3 py-1.5 text-xs font-bold text-white"
                              >
                                Issue
                              </button>
                            </div>
                          </div>
                        ))
                      : null}
                  </div>
                )
              })}
            </FeatureCard>
          )}
        </div>
      )}

      {tab === 'tracking' && isManager && (
        <div className="space-y-3">
          {trackIssue ? (
            <HsIssueDetail
              issue={trackIssue}
              talk={resolveTalk(trackIssue)}
              signatures={issueSignatures(data.signatures, trackIssue.id)}
              users={users}
              canSign={Boolean(pendingForCurrentUser(issueSignatures(data.signatures, trackIssue.id)))}
              canViewSigned={Boolean(signedForCurrentUser(issueSignatures(data.signatures, trackIssue.id)))}
              downloadError={downloadError}
              reminding={reminding}
              onBack={() => {
                setTrackIssue(null)
                setDownloadError(null)
              }}
              onView={() => {
                const talk = resolveTalk(trackIssue)
                setViewTalk(
                  talk || {
                    id: trackIssue.talkId,
                    title: 'Toolbox talk',
                    category: 'general',
                    isGeneral: true,
                    trades: [],
                    purpose: '',
                    keyPoints: [],
                    source: 'library',
                    status: 'approved',
                    version: 1,
                    updatedAt: new Date(),
                  }
                )
              }}
              onSign={() => {
                if (pendingForCurrentUser(issueSignatures(data.signatures, trackIssue.id))) {
                  openSign(trackIssue)
                  return
                }
                setViewSignedIssue(trackIssue)
              }}
              onDownload={() => handleDownloadTalk(resolveTalk(trackIssue), trackIssue)}
              onRemind={() => {
                if (!organization?.id) return
                setReminding(true)
                void remindPending(
                  organization.id,
                  project.id,
                  isSmallWorks,
                  trackIssue.id,
                  resolveTalk(trackIssue)?.title || 'Toolbox talk'
                ).finally(() => setReminding(false))
              }}
              onAddRecipients={() => {
                setExtraRecipients([])
                setShowAddRecipients(true)
              }}
            />
          ) : (
            <>
          {scheduledIssues.length > 0 && (
            <div>
              <FeatureSectionLabel>Scheduled</FeatureSectionLabel>
              {scheduledIssues.map((issue) => {
                const talk = resolveTalk(issue)
                return (
                  <FeatureCard key={issue.id} className="mb-2 p-4">
                    <p className="text-sm font-semibold text-slate-900">{talk?.title || 'Toolbox talk'}</p>
                    <p className="text-xs text-slate-500">
                      {issue.publishAt ? format(issue.publishAt, "EEE d MMM yyyy 'at' HH:mm") : 'Scheduled'} ·{' '}
                      {issue.recipientUserIds.length} recipients
                    </p>
                  </FeatureCard>
                )
              })}
            </div>
          )}
          {activeIssues.length === 0 ? (
            <EmptyState title="Nothing sent yet" description="Issue a toolbox talk from the library." />
          ) : (
            activeIssues.map((issue) => {
              const talk = resolveTalk(issue)
              const sigs = issueSignatures(data.signatures, issue.id)
              return (
                <HsTrackingIssueCard
                  key={issue.id}
                  title={talk?.title || 'Toolbox talk'}
                  reference={talk?.referenceCode}
                  issuedAt={issue.issuedAt}
                  weekCommencing={issue.weekCommencing}
                  signatures={sigs}
                  recipientCount={issue.recipientUserIds.length}
                  onOpen={() => {
                    setDownloadError(null)
                    setTrackIssue(issue)
                  }}
                />
              )
            })
          )}
            </>
          )}
        </div>
      )}

      {tab === 'rams' && (
        <div className="space-y-4">
          {isManager && (
            <button
              type="button"
              onClick={() => setShowAddRams(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#2f73f0]/40 bg-[#e8f0ff] py-2.5 text-sm font-semibold text-[#2f73f0]"
            >
              + Upload RAMS
            </button>
          )}
          <FeatureSectionLabel>RAMS documents</FeatureSectionLabel>
          {data.ramsDocuments.length === 0 ? (
            <EmptyState title="No RAMS yet" description="Upload RAMS for this job. You can add more than one copy." />
          ) : (
            <FeatureCard>
              {data.ramsDocuments.map((doc) => (
                <DocListRow
                  key={doc.id}
                  title={doc.title}
                  meta={`${doc.trade} · v${doc.version} · ${format(doc.uploadedAt, 'd MMM yyyy')}`}
                  status={doc.status}
                  statusTone={doc.status === 'Active' ? 'green' : 'amber'}
                  fileURL={doc.fileURL}
                />
              ))}
            </FeatureCard>
          )}
        </div>
      )}

      {tab === 'other' && (
        <div className="space-y-4">
          {isManager && (
            <button
              type="button"
              onClick={() => setShowAddOther(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#2f73f0]/40 bg-[#e8f0ff] py-2.5 text-sm font-semibold text-[#2f73f0]"
            >
              + Add Trade / Site Doc
            </button>
          )}
          <FeatureSectionLabel>Other documents</FeatureSectionLabel>
          {data.otherDocuments.length === 0 ? (
            <EmptyState title="No documents yet" description="Upload policies and supporting H&S files." />
          ) : (
            <FeatureCard>
              {data.otherDocuments.map((doc) => (
                <DocListRow
                  key={doc.id}
                  title={doc.title}
                  meta={`${doc.category}${doc.trade ? ` · ${doc.trade}` : ''} · ${format(doc.uploadedAt, 'd MMM yyyy')}`}
                  fileURL={doc.fileURL}
                />
              ))}
            </FeatureCard>
          )}
        </div>
      )}

      {showIssue && (
        <HsSheet
          title="Issue toolbox talk"
          onClose={() => setShowIssue(false)}
          footer={
            <HsPrimaryButton
              onClick={() => void submitIssue()}
              disabled={!issueTalkId || recipientsWithIssuer(issueRecipients, user?.id || '', signAsIssuer).length === 0}
            >
              Issue now
            </HsPrimaryButton>
          }
        >
          {selectedIssueTalk ? (
            <HsFieldCard>
              <p className="text-sm font-semibold text-slate-900">{selectedIssueTalk.title}</p>
              <p className="text-xs text-slate-500">
                {selectedIssueTalk.referenceCode ? `${selectedIssueTalk.referenceCode} · ` : ''}
                {selectedIssueTalk.category}
              </p>
            </HsFieldCard>
          ) : (
            <HsTalkPicker talks={libraryTalks} selectedId={issueTalkId} onSelect={setIssueTalkId} />
          )}
          <HsSectionLabel>Recipients</HsSectionLabel>
          <label className="flex items-start gap-3 rounded-2xl border border-[#EEF0F3] bg-white px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[#0fae9e]"
              checked={signAsIssuer}
              onChange={(event) => setSignAsIssuer(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Sign as issuer</span>
              <span className="block text-[11px] text-slate-500">
                Add me as a recipient so I can preview, download the signed talk, and sign it myself.
              </span>
            </span>
          </label>
          <HsRecipientPicker users={operativeUsers} selectedIds={issueRecipients} onChange={setIssueRecipients} />
        </HsSheet>
      )}

      {showUploadTalk && (
        <HsSheet
          title="Upload custom talk"
          onClose={() => setShowUploadTalk(false)}
          footer={
            <HsPrimaryButton
              type="submit"
              tone="blue"
              disabled={!uploadTitle.trim() || uploading}
              onClick={() => {
                const form = document.getElementById('hs-upload-talk-form') as HTMLFormElement | null
                form?.requestSubmit()
              }}
            >
              {uploading ? 'Saving…' : 'Save to library'}
            </HsPrimaryButton>
          }
        >
          <HsHero title="Upload a custom talk" subtitle="It stays with this job’s library" tone="blue" />
          <form id="hs-upload-talk-form" onSubmit={submitUploadTalk} className="space-y-4">
            <HsSectionLabel extra={<span className="text-[10px] font-medium text-[#A32D2D]">REQUIRED</span>}>
              Talk
            </HsSectionLabel>
            <HsFieldCard>
              <FormInput
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Talk title"
                required
              />
              <textarea
                value={uploadPurpose}
                onChange={(e) => setUploadPurpose(e.target.value)}
                placeholder="Purpose (optional)"
                rows={3}
                className="w-full resize-none bg-transparent text-sm text-slate-900 outline-none"
              />
            </HsFieldCard>
            <HsSectionLabel>Category</HsSectionLabel>
            <HsFieldCard>
              <FormInput
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                placeholder="general, electrical…"
              />
            </HsFieldCard>
            <HsSectionLabel>Trades</HsSectionLabel>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setUploadIsGeneral(true)
                  setUploadTrades([])
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  uploadIsGeneral ? 'bg-[#0fae9e] text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                General
              </button>
              {STAFF_TRADE_PRESETS.map((trade) => {
                const on = uploadTrades.includes(trade)
                return (
                  <button
                    key={trade}
                    type="button"
                    onClick={() => toggleUploadTrade(trade)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      on ? 'bg-[#0fae9e] text-white' : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {trade}
                  </button>
                )
              })}
            </div>
            <HsSectionLabel extra={<span className="text-[11px] text-[#C5C9D2]">Optional</span>}>Key points</HsSectionLabel>
            <HsFieldCard>
              {uploadKeyPoints.map((point, index) => (
                <input
                  key={index}
                  value={point}
                  onChange={(e) =>
                    setUploadKeyPoints((prev) => prev.map((row, i) => (i === index ? e.target.value : row)))
                  }
                  placeholder={`Point ${index + 1}`}
                  className="w-full border-b border-[#EEF0F3] bg-transparent py-1.5 text-sm outline-none last:border-0"
                />
              ))}
              <button
                type="button"
                onClick={() => setUploadKeyPoints((prev) => [...prev, ''])}
                className="text-xs font-semibold text-[var(--blue)]"
              >
                + Add point
              </button>
            </HsFieldCard>
            <HsFileButton file={uploadTalkFile} onChange={setUploadTalkFile} />
          </form>
        </HsSheet>
      )}

      {showScheduled && (
        <HsSheet
          wide
          title="Schedule toolbox talk"
          onClose={() => setShowScheduled(false)}
          footer={
            <HsPrimaryButton
              tone="blue"
              onClick={() => void submitSchedule()}
              disabled={
                !scheduleTalkId ||
                recipientsWithIssuer(scheduleRecipients, user?.id || '', scheduleSignAsIssuer).length === 0 ||
                !schedulePublishAt
              }
            >
              {schedulePublishAt && schedulePublishAt.getTime() <= Date.now()
                ? 'Issue now (time is in the past)'
                : 'Schedule talk'}
            </HsPrimaryButton>
          }
        >
          <HsHero title="Schedule a toolbox talk" subtitle="Set the date, time and who should receive it" tone="blue" />
          <HsSectionLabel>Talk</HsSectionLabel>
          <HsTalkPicker talks={libraryTalks} selectedId={scheduleTalkId} onSelect={setScheduleTalkId} />
          {selectedScheduleTalk && (
            <p className="px-1 text-[11px] text-slate-500">
              Selected: {selectedScheduleTalk.title}
              {selectedScheduleTalk.trades.length > 0 ? ` · ${selectedScheduleTalk.trades.join(', ')}` : ''}
            </p>
          )}
          <HsSectionLabel extra={<span className="text-[10px] font-medium text-[#A32D2D]">REQUIRED</span>}>
            Date and time
          </HsSectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <HsFieldCard>
              <p className="text-[11px] font-semibold uppercase text-slate-400">Date</p>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              />
            </HsFieldCard>
            <HsFieldCard>
              <p className="text-[11px] font-semibold uppercase text-slate-400">Time</p>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              />
            </HsFieldCard>
          </div>
          {schedulePublishAt && (
            <p className="px-1 text-[11px] text-slate-500">
              Goes live {format(schedulePublishAt, "EEEE d MMM yyyy 'at' HH:mm")}
            </p>
          )}
          <HsSectionLabel>Recipients</HsSectionLabel>
          <label className="flex items-start gap-3 rounded-2xl border border-[#EEF0F3] bg-white px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[#0fae9e]"
              checked={scheduleSignAsIssuer}
              onChange={(event) => setScheduleSignAsIssuer(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Sign as issuer</span>
              <span className="block text-[11px] text-slate-500">
                Include me on the sign-off sheet when this talk goes live.
              </span>
            </span>
          </label>
          <HsRecipientPicker users={operativeUsers} selectedIds={scheduleRecipients} onChange={setScheduleRecipients} />
          {scheduledIssues.length > 0 && (
            <div>
              <HsSectionLabel>Already scheduled · {scheduledIssues.length}</HsSectionLabel>
              <FeatureCard>
                {scheduledIssues.map((issue) => (
                  <div key={issue.id} className="border-t border-[#EEF1F5] px-4 py-3 first:border-t-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {libraryTalks.find((t) => t.id === issue.talkId)?.title ||
                        data.talks.find((t) => t.id === issue.talkId)?.title ||
                        'Toolbox talk'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {issue.publishAt ? format(issue.publishAt, "EEE d MMM yyyy 'at' HH:mm") : '—'} ·{' '}
                      {issue.recipientUserIds.length} recipients
                    </p>
                  </div>
                ))}
              </FeatureCard>
            </div>
          )}
        </HsSheet>
      )}

      {showAddRams && (
        <HsSheet
          title="Upload RAMS"
          onClose={() => setShowAddRams(false)}
          footer={
            <HsPrimaryButton
              type="submit"
              tone="blue"
              disabled={!ramsTitle.trim() || uploading}
              onClick={() => {
                const form = document.getElementById('hs-upload-rams-form') as HTMLFormElement | null
                form?.requestSubmit()
              }}
            >
              {uploading ? 'Uploading…' : 'Upload RAMS'}
            </HsPrimaryButton>
          }
        >
          <HsHero title="Upload RAMS" subtitle="You can add more than one copy for this job" tone="blue" />
          <form id="hs-upload-rams-form" onSubmit={addRams} className="space-y-4">
            <HsSectionLabel extra={<span className="text-[10px] font-medium text-[#A32D2D]">REQUIRED</span>}>
              Title
            </HsSectionLabel>
            <HsFieldCard>
              <FormInput
                value={ramsTitle}
                onChange={(e) => setRamsTitle(e.target.value)}
                placeholder="RAMS title"
                required
              />
            </HsFieldCard>
            <HsSectionLabel>Trade</HsSectionLabel>
            <HsChipRow chips={RAMS_TRADES} selected={ramsTrade} onSelect={setRamsTrade} />
            <HsFileButton file={ramsFile} onChange={setRamsFile} />
          </form>
        </HsSheet>
      )}

      {showAddOther && (
        <HsSheet
          title="Add Trade / Site Doc"
          onClose={() => setShowAddOther(false)}
          footer={
            <HsPrimaryButton
              type="submit"
              tone="blue"
              disabled={!otherTitle.trim() || uploading}
              onClick={() => {
                const form = document.getElementById('hs-upload-other-form') as HTMLFormElement | null
                form?.requestSubmit()
              }}
            >
              {uploading ? 'Uploading…' : 'Add document'}
            </HsPrimaryButton>
          }
        >
          <HsHero title="Add Trade / Site Doc" subtitle="Policies, COSHH, permits and supporting files" tone="blue" />
          <form id="hs-upload-other-form" onSubmit={addOther} className="space-y-4">
            <HsSectionLabel>Trade</HsSectionLabel>
            <HsChipRow chips={RAMS_TRADES} selected={otherTrade} onSelect={setOtherTrade} />
            <HsSectionLabel extra={<span className="text-[10px] font-medium text-[#A32D2D]">REQUIRED</span>}>
              Title
            </HsSectionLabel>
            <HsFieldCard>
              <FormInput
                value={otherTitle}
                onChange={(e) => setOtherTitle(e.target.value)}
                placeholder="Document title"
                required
              />
            </HsFieldCard>
            <HsFileButton file={otherFile} onChange={setOtherFile} />
          </form>
        </HsSheet>
      )}

      {showAddRecipients && trackIssue && (
        <HsSheet
          title="Send to further operatives"
          onClose={() => setShowAddRecipients(false)}
          footer={
            <HsPrimaryButton
              disabled={extraRecipients.length === 0}
              onClick={() => {
                if (!organization?.id) return
                void addRecipients(organization.id, project.id, isSmallWorks, trackIssue.id, extraRecipients).then(
                  () => {
                    setShowAddRecipients(false)
                    setExtraRecipients([])
                  }
                )
              }}
            >
              Add recipients
            </HsPrimaryButton>
          }
        >
          <HsSectionLabel>People who have not received this talk yet</HsSectionLabel>
          <HsRecipientPicker
            users={operativeUsers.filter((row) => !trackIssue.recipientUserIds.includes(row.id))}
            selectedIds={extraRecipients}
            onChange={setExtraRecipients}
          />
        </HsSheet>
      )}

      {viewTalk && (
        <HsSheet
          wide
          title="Toolbox talk"
          onClose={() => setViewTalk(null)}
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDownloadTalk(viewTalk, trackIssue || undefined)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
              >
                Download talk
              </button>
              <HsPrimaryButton onClick={() => setViewTalk(null)}>Done</HsPrimaryButton>
            </div>
          }
        >
          <HsTalkBody talk={viewTalk} />
          {downloadError ? <p className="text-sm font-semibold text-[#A32D2D]">{downloadError}</p> : null}
        </HsSheet>
      )}

      {viewSignedIssue && (
        <HsSheet
          wide
          title="Signed talk"
          onClose={() => setViewSignedIssue(null)}
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDownloadTalk(resolveTalk(viewSignedIssue), viewSignedIssue)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
              >
                Download talk
              </button>
              <HsPrimaryButton onClick={() => setViewSignedIssue(null)}>Done</HsPrimaryButton>
            </div>
          }
        >
          <HsSignedTalkBody
            talk={resolveTalk(viewSignedIssue)}
            signatures={issueSignatures(data.signatures, viewSignedIssue.id)}
            users={users}
          />
        </HsSheet>
      )}

      {signIssue && (
        <HsSheet
          title="Sign toolbox talk"
          onClose={() => {
            setSignIssue(null)
            setSignatureB64(null)
            setReadConfirmed(false)
          }}
          footer={
            <HsPrimaryButton
              disabled={!signatureB64 || !readConfirmed || signing}
              onClick={() => void submitSign()}
            >
              {signing ? 'Saving…' : 'Confirm signature'}
            </HsPrimaryButton>
          }
        >
          <p className="text-sm font-semibold text-slate-900">{signTalk?.title || 'Toolbox talk'}</p>
          {signTalk?.purpose ? <p className="text-sm text-slate-600">{signTalk.purpose}</p> : null}
          {signTalk && signTalk.keyPoints.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              {signTalk.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
          <label className="flex items-start gap-2 rounded-2xl border border-[#EEF0F3] bg-white p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={readConfirmed}
              onChange={(e) => setReadConfirmed(e.target.checked)}
            />
            I have read this toolbox talk and understand the control points.
          </label>
          <SignaturePad onChange={setSignatureB64} />
        </HsSheet>
      )}
    </FeatureScreen>
  )
}
