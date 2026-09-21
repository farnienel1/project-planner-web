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
import { uploadFile, healthSafetyFilePath } from '@/lib/firebase/storageUtils'
import { loadPlatformToolboxLibrary, mergeToolboxTalkLibraries } from '@/lib/healthSafety/toolboxLibrary'
import { buildToolboxTalkPdfHtml, openToolboxTalkPdf } from '@/lib/healthSafety/toolboxTalkPdf'
import {
  combineLocalDateAndTime,
  defaultScheduleDate,
  defaultScheduleTime,
  filterToolboxTalks,
  nextRamsVersion,
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

const OTHER_CATEGORIES = ['Trade', 'Site', 'Policy', 'COSHH', 'Permit', 'Certificate', 'Insurance']
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
  const { data, loading, error, load, save, issueToolboxTalk, signToolboxTalk, addToolboxTalk } =
    useHealthSafetyStore()
  const { users, loadUsers } = useOrgUserStore()

  const isManager = !isOperativeMode(user)
  const [tab, setTab] = useState<ManagerTab>('hub')
  const [talkSearch, setTalkSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')

  const [showIssue, setShowIssue] = useState(false)
  const [issueTalkId, setIssueTalkId] = useState('')
  const [issueRecipients, setIssueRecipients] = useState<string[]>([])
  const [showUploadTalk, setShowUploadTalk] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadPurpose, setUploadPurpose] = useState('')
  const [uploadCategory, setUploadCategory] = useState('general')
  const [uploadTrades, setUploadTrades] = useState<string[]>([])
  const [uploadIsGeneral, setUploadIsGeneral] = useState(true)
  const [uploadKeyPoints, setUploadKeyPoints] = useState<string[]>([''])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [showScheduled, setShowScheduled] = useState(false)
  const [showAddRams, setShowAddRams] = useState(false)
  const [showAddOther, setShowAddOther] = useState(false)
  const [signIssue, setSignIssue] = useState<HSToolboxIssue | null>(null)
  const [signatureB64, setSignatureB64] = useState<string | null>(null)
  const [readConfirmed, setReadConfirmed] = useState(false)
  const [signing, setSigning] = useState(false)

  const [ramsTitle, setRamsTitle] = useState('')
  const [ramsTrade, setRamsTrade] = useState('General')
  const [ramsFile, setRamsFile] = useState<File | null>(null)
  const [otherTitle, setOtherTitle] = useState('')
  const [otherCategory, setOtherCategory] = useState('Trade')
  const [otherTrade, setOtherTrade] = useState('General')
  const [otherFile, setOtherFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

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
      if (isManager) loadUsers(organization.id)
    }
  }, [organization, project.id, isSmallWorks, load, loadUsers, isManager])

  useEffect(() => {
    if (!isManager) return
    setLibraryLoading(true)
    loadPlatformToolboxLibrary()
      .then(setPlatformTalks)
      .catch(() => setPlatformTalks([]))
      .finally(() => setLibraryLoading(false))
  }, [isManager])

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

  const myAssigned = useMemo(() => {
    if (!user || !data) return []
    return data.signatures
      .filter((sig) => sig.userId === user.id)
      .map((sig) => {
        const issue = data.issues.find((i) => i.id === sig.issueId)
        if (!issue || !projectIdsMatch(issue.projectId, project.id)) return null
        if (issue.publishAt && issue.publishAt.getTime() > Date.now()) return null
        return {
          issue,
          signature: sig,
          talk: libraryTalks.find((t) => t.id === issue.talkId) || data.talks.find((t) => t.id === issue.talkId),
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
  }, [data, user, project.id, libraryTalks])

  const pendingMine = myAssigned.filter((e) => e.signature.status !== 'signed').length

  const filteredTalks = useMemo(
    () => filterToolboxTalks(libraryTalks, talkSearch, tradeFilter),
    [libraryTalks, talkSearch, tradeFilter]
  )

  const tradeFilters = useMemo(() => talkTradeFilters(libraryTalks), [libraryTalks])

  const operativeUsers = useMemo(() => users.filter(isHsRecipient), [users])

  const schedulePublishAt = useMemo(
    () => combineLocalDateAndTime(scheduleDate, scheduleTime),
    [scheduleDate, scheduleTime]
  )

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
    if (!organization?.id || !user || !issueTalkId || issueRecipients.length === 0) return
    await ensureTalkOnProject(issueTalkId)
    await issueToolboxTalk(organization.id, project.id, isSmallWorks, issueTalkId, issueRecipients, user.id, {
      weekCommencing: startOfWeek(new Date(), { weekStartsOn: 1 }),
    })
    setShowIssue(false)
    setIssueTalkId('')
    setIssueRecipients([])
  }

  const submitSchedule = async () => {
    if (!organization?.id || !user || !scheduleTalkId || scheduleRecipients.length === 0 || !schedulePublishAt) return
    await ensureTalkOnProject(scheduleTalkId)
    await issueToolboxTalk(organization.id, project.id, isSmallWorks, scheduleTalkId, scheduleRecipients, user.id, {
      weekCommencing: startOfWeek(schedulePublishAt, { weekStartsOn: 1 }),
      publishAt: schedulePublishAt,
    })
    setScheduleTalkId('')
    setScheduleRecipients([])
    setScheduleDate(defaultScheduleDate())
    setScheduleTime(defaultScheduleTime())
  }

  const submitUploadTalk = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !uploadTitle.trim()) return
    setUploading(true)
    try {
      let fileURL: string | undefined
      if (uploadFile) {
        const path = healthSafetyFilePath(organization.id, project.id, 'talks', uploadFile.name)
        fileURL = await uploadFile(path, uploadFile, uploadFile.type || 'application/octet-stream')
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
      setUploadFile(null)
      setTab('library')
    } finally {
      setUploading(false)
    }
  }

  const submitSign = async () => {
    if (!organization?.id || !user || !signIssue || !signatureB64 || !readConfirmed) return
    setSigning(true)
    try {
      await signToolboxTalk(organization.id, project.id, isSmallWorks, signIssue.id, user.id, signatureB64)
      setSignIssue(null)
      setSignatureB64(null)
      setReadConfirmed(false)
    } finally {
      setSigning(false)
    }
  }

  const addRams = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !data || !ramsTitle.trim()) return
    setUploading(true)
    try {
      let fileURL: string | undefined
      if (ramsFile) {
        const path = healthSafetyFilePath(organization.id, project.id, 'rams', ramsFile.name)
        fileURL = await uploadFile(path, ramsFile, ramsFile.type || 'application/octet-stream')
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
    } finally {
      setUploading(false)
    }
  }

  const addOther = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !data || !otherTitle.trim()) return
    setUploading(true)
    try {
      let fileURL: string | undefined
      if (otherFile) {
        const path = healthSafetyFilePath(organization.id, project.id, 'other', otherFile.name)
        fileURL = await uploadFile(path, otherFile, otherFile.type || 'application/octet-stream')
      }
      await save(organization.id, project.id, isSmallWorks, {
        ...data,
        otherDocuments: [
          {
            id: newUuid(),
            title: otherTitle.trim(),
            trade: otherCategory === 'Trade' ? otherTrade : undefined,
            category: otherCategory,
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
    } finally {
      setUploading(false)
    }
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

  if (loading) return <LoadingSpinner />
  if (!data) return <EmptyState title="H&S unavailable" description="Could not load health & safety data." />

  return (
    <FeatureScreen>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

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

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-[13px] bg-[#e7ebf1] p-1">
        {managerTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-w-[72px] flex-1 rounded-[10px] py-2 text-xs font-bold transition-colors ${
              tab === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'hub' && (
        <div className="space-y-4">
          {isManager && (
            <div className="rounded-2xl bg-[#E6F1FB] px-4 py-3">
              <p className="text-sm font-semibold text-[#185FA5]">Manager access</p>
              <p className="text-xs text-[#185FA5]/80">Add, edit, issue &amp; track all H&amp;S records</p>
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
                      <button
                        type="button"
                        onClick={() => {
                          if (!pending) return
                          setSignatureB64(null)
                          setReadConfirmed(false)
                          setSignIssue(issue)
                        }}
                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${
                          pending ? 'bg-[#0fae9e] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {pending ? 'Sign now' : 'Signed'}
                      </button>
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
                    {data.signatures.filter((s) => s.status === 'pending').length}
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
                count={pendingMine}
                countLabel="your pending"
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
              {filteredTalks.map((talk: HSToolboxTalk) => (
                <div
                  key={talk.id}
                  className="flex items-center justify-between gap-2 border-t border-[#EEF1F5] px-4 py-3 first:border-t-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{talk.title}</p>
                    <p className="text-xs text-slate-500">
                      {talk.referenceCode ? `${talk.referenceCode} · ` : ''}
                      {talk.category} · {talk.source}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIssueTalkId(talk.id)
                      setShowIssue(true)
                    }}
                    className="shrink-0 rounded-lg bg-[#2f73f0] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Issue
                  </button>
                </div>
              ))}
            </FeatureCard>
          )}
        </div>
      )}

      {tab === 'tracking' && isManager && (
        <div className="space-y-3">
          {scheduledIssues.length > 0 && (
            <div>
              <FeatureSectionLabel>Scheduled</FeatureSectionLabel>
              {scheduledIssues.map((issue) => {
                const talk = libraryTalks.find((t) => t.id === issue.talkId) || data.talks.find((t) => t.id === issue.talkId)
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
              const talk = libraryTalks.find((t) => t.id === issue.talkId) || data.talks.find((t) => t.id === issue.talkId)
              const sigs = data.signatures.filter((s) => s.issueId === issue.id)
              const signed = sigs.filter((s) => s.status === 'signed').length
              const handlePdf = () => {
                if (!talk || !organization) return
                const html = buildToolboxTalkPdfHtml({
                  talk,
                  issue,
                  signatures: sigs,
                  users,
                  project,
                  organizationName: organization.name || 'Organisation',
                  presentedBy: `${user?.firstName || ''} ${user?.surname || ''}`.trim() || organization.name || 'Project Planner',
                })
                openToolboxTalkPdf(html, `ToolboxTalk-${talk.referenceCode || talk.id}-${issue.id}.html`)
              }
              return (
                <FeatureCard key={issue.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{talk?.title || 'Toolbox talk'}</p>
                      <p className="text-xs text-slate-500">
                        {talk?.referenceCode ? `${talk.referenceCode} · ` : ''}
                        Issued {format(issue.issuedAt, 'd MMM yyyy')} · W/C {format(issue.weekCommencing, 'd MMM')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePdf}
                      className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Generate PDF
                    </button>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#0fae9e]">
                    {signed}/{sigs.length} signed
                  </p>
                  <ul className="mt-2 space-y-1">
                    {sigs.map((sig) => {
                      const u = users.find((x) => x.id === sig.userId)
                      return (
                        <li key={sig.id} className="flex justify-between text-xs text-slate-600">
                          <span>{u ? `${u.firstName} ${u.surname}`.trim() || u.email : sig.userId}</span>
                          <span className={sig.status === 'signed' ? 'text-green-600' : 'text-amber-600'}>
                            {sig.status}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </FeatureCard>
              )
            })
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
            <HsPrimaryButton onClick={() => void submitIssue()} disabled={!issueTalkId || issueRecipients.length === 0}>
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
                className="text-xs font-semibold text-[#185FA5]"
              >
                + Add point
              </button>
            </HsFieldCard>
            <HsFileButton file={uploadFile} onChange={setUploadFile} />
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
              disabled={!scheduleTalkId || scheduleRecipients.length === 0 || !schedulePublishAt}
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
            <HsSectionLabel>Type</HsSectionLabel>
            <HsChipRow chips={OTHER_CATEGORIES} selected={otherCategory} onSelect={setOtherCategory} />
            {otherCategory === 'Trade' && (
              <>
                <HsSectionLabel>Trade</HsSectionLabel>
                <HsChipRow chips={RAMS_TRADES} selected={otherTrade} onSelect={setOtherTrade} />
              </>
            )}
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
