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
import { SignaturePad } from '@/components/forms/SignaturePad'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import type { HSToolboxIssue, HSToolboxTalk, Project } from '@/types'
import {
  DocListRow,
  FeatureCard,
  FeatureScreen,
  FeatureSectionLabel,
  HubCard,
} from '@/components/projects/features/featureUi'

type ManagerTab = 'hub' | 'library' | 'tracking' | 'rams' | 'other'

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
  const [tab, setTab] = useState<ManagerTab>(() => (isManager ? 'hub' : 'hub'))
  const [talkSearch, setTalkSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')

  const [showIssue, setShowIssue] = useState(false)
  const [issueTalkId, setIssueTalkId] = useState('')
  const [issueRecipients, setIssueRecipients] = useState<string[]>([])
  const [showUploadTalk, setShowUploadTalk] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadPurpose, setUploadPurpose] = useState('')
  const [showScheduled, setShowScheduled] = useState(false)
  const [showAddRams, setShowAddRams] = useState(false)
  const [showAddOther, setShowAddOther] = useState(false)
  const [signIssue, setSignIssue] = useState<HSToolboxIssue | null>(null)
  const [signatureB64, setSignatureB64] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)

  const [ramsTitle, setRamsTitle] = useState('')
  const [ramsTrade, setRamsTrade] = useState('General')
  const [ramsFile, setRamsFile] = useState<File | null>(null)
  const [otherTitle, setOtherTitle] = useState('')
  const [otherCategory, setOtherCategory] = useState('General')
  const [otherFile, setOtherFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [scheduleTalkId, setScheduleTalkId] = useState('')
  const [scheduleRecipients, setScheduleRecipients] = useState<string[]>([])
  const [schedulePublishAt, setSchedulePublishAt] = useState('')
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
        return { issue, signature: sig, talk: libraryTalks.find((t) => t.id === issue.talkId) || data.talks.find((t) => t.id === issue.talkId) }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
  }, [data, user, project.id])

  const pendingMine = myAssigned.filter((e) => e.signature.status !== 'signed').length

  const filteredTalks = useMemo(() => {
    let talks = libraryTalks
    const q = talkSearch.trim().toLowerCase()
    if (q) {
      talks = talks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.purpose.toLowerCase().includes(q) ||
          (t.referenceCode || '').toLowerCase().includes(q) ||
          t.trades.some((tr) => tr.toLowerCase().includes(q))
      )
    }
    if (tradeFilter !== 'All') {
      talks = talks.filter((t) => t.isGeneral || t.trades.includes(tradeFilter))
    }
    return talks
  }, [libraryTalks, talkSearch, tradeFilter])

  const tradeFilters = useMemo(() => {
    const set = new Set<string>(['All'])
    for (const t of libraryTalks) {
      for (const tr of t.trades) set.add(tr)
    }
    return Array.from(set)
  }, [libraryTalks])

  const operativeUsers = useMemo(
    () => users.filter((u) => u.isActive && (u.permissions.operatives || u.role === 'operative' || u.permissions.manager)),
    [users]
  )

  const toggleRecipient = (id: string) => {
    setIssueRecipients((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleScheduleRecipient = (id: string) => {
    setScheduleRecipients((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submitIssue = async () => {
    if (!organization?.id || !user || !issueTalkId || issueRecipients.length === 0) return
    const selectedTalk = libraryTalks.find((talk) => talk.id === issueTalkId)
    if (selectedTalk && !data?.talks.some((talk) => talk.id === selectedTalk.id)) {
      await addToolboxTalk(organization.id, project.id, isSmallWorks, selectedTalk)
    }
    await issueToolboxTalk(
      organization.id,
      project.id,
      isSmallWorks,
      issueTalkId,
      issueRecipients,
      user.id,
      { weekCommencing: startOfWeek(new Date(), { weekStartsOn: 1 }) }
    )
    setShowIssue(false)
    setIssueTalkId('')
    setIssueRecipients([])
  }

  const submitSchedule = async () => {
    if (!organization?.id || !user || !scheduleTalkId || scheduleRecipients.length === 0 || !schedulePublishAt)
      return
    await issueToolboxTalk(
      organization.id,
      project.id,
      isSmallWorks,
      scheduleTalkId,
      scheduleRecipients,
      user.id,
      {
        weekCommencing: startOfWeek(new Date(schedulePublishAt), { weekStartsOn: 1 }),
        publishAt: new Date(schedulePublishAt),
      }
    )
    setShowScheduled(false)
    setScheduleTalkId('')
    setScheduleRecipients([])
    setSchedulePublishAt('')
  }

  const submitUploadTalk = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !uploadTitle.trim()) return
    await addToolboxTalk(organization.id, project.id, isSmallWorks, {
      title: uploadTitle.trim(),
      category: 'general',
      isGeneral: true,
      trades: [],
      purpose: uploadPurpose.trim(),
      keyPoints: [],
      source: 'uploaded',
      status: 'approved',
      version: 1,
    })
    setShowUploadTalk(false)
    setUploadTitle('')
    setUploadPurpose('')
    setTab('library')
  }

  const submitSign = async () => {
    if (!organization?.id || !user || !signIssue || !signatureB64) return
    setSigning(true)
    try {
      await signToolboxTalk(organization.id, project.id, isSmallWorks, signIssue.id, user.id, signatureB64)
      setSignIssue(null)
      setSignatureB64(null)
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
      await save(organization.id, project.id, isSmallWorks, {
        ...data,
        ramsDocuments: [
          {
            id: newUuid(),
            title: ramsTitle.trim(),
            trade: ramsTrade,
            version: 1,
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

  const managerTabs: { id: ManagerTab; label: string }[] = isManager
    ? [
        { id: 'hub', label: 'Hub' },
        { id: 'library', label: 'Library' },
        { id: 'tracking', label: 'Tracking' },
        { id: 'rams', label: 'RAMS' },
        { id: 'other', label: 'Other' },
      ]
    : [
        { id: 'hub', label: 'Hub' },
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold">Health &amp; Safety</p>
          <p className="text-xs opacity-90">
            {isManager ? 'Hub, library, tracking & documents' : 'Sign toolbox talks, view RAMS'}
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
                        <p className="text-xs text-slate-500">
                          W/C {format(issue.weekCommencing, 'd MMM yyyy')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => (pending ? setSignIssue(issue) : null)}
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
              <FeatureSectionLabel>This project</FeatureSectionLabel>
              <div className="grid grid-cols-3 gap-2">
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
                  <p className="text-[10px] text-slate-500">RAMS docs</p>
                </FeatureCard>
              </div>

              <FeatureSectionLabel>Quick actions</FeatureSectionLabel>
              <div className="space-y-2">
                <HubActionRow
                  title="Issue a toolbox talk"
                  subtitle="Pick a talk and send to operatives"
                  onClick={() => {
                    setTab('library')
                    setShowIssue(true)
                  }}
                />
                <HubActionRow
                  title="Upload a toolbox talk"
                  subtitle="Add your own talk to the library"
                  onClick={() => setShowUploadTalk(true)}
                />
                <HubActionRow
                  title="Upload RAMS"
                  subtitle="Risk assessment and method statement"
                  onClick={() => setShowAddRams(true)}
                />
                <HubActionRow
                  title="Add H&S document"
                  subtitle="Policies, COSHH, permits and more"
                  onClick={() => setShowAddOther(true)}
                />
                <HubActionRow
                  title="Scheduled toolbox talks"
                  subtitle="Manage future talks and recipients"
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
            <EmptyState title="No toolbox talks to sign" description="Issued talks will appear here." />
          )}
        </div>
      )}

      {tab === 'library' && isManager && (
        <div className="space-y-3">
          <FormInput
            value={talkSearch}
            onChange={(e) => setTalkSearch(e.target.value)}
            placeholder="Search toolbox talks"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tradeFilters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTradeFilter(f)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  tradeFilter === f ? 'bg-[#0fae9e] text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowUploadTalk(true)}
            className="text-sm font-semibold text-[#2f73f0]"
          >
            + Upload custom talk
          </button>
          {libraryLoading ? (
            <LoadingSpinner label="Loading toolbox library…" />
          ) : filteredTalks.length === 0 ? (
            <EmptyState
              title="No toolbox talks"
              description="The shared library loads from Firebase platformConfig. Upload a custom talk or add talks on iOS."
            />
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
          {activeIssues.length === 0 ? (
            <EmptyState title="No issued talks" description="Issue a toolbox talk from the library." />
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
                openToolboxTalkPdf(
                  html,
                  `ToolboxTalk-${talk.referenceCode || talk.id}-${issue.id}.html`
                )
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
          {isManager && showAddRams && (
            <FeatureCard className="p-4">
              <p className="mb-3 text-sm font-bold text-slate-900">Upload RAMS</p>
              <form onSubmit={addRams} className="space-y-3">
                <FormInput value={ramsTitle} onChange={(e) => setRamsTitle(e.target.value)} placeholder="Title" required />
                <FormInput value={ramsTrade} onChange={(e) => setRamsTrade(e.target.value)} placeholder="Trade" />
                <input type="file" accept=".pdf,image/*" onChange={(e) => setRamsFile(e.target.files?.[0] || null)} className="text-sm" />
                <button type="submit" disabled={uploading} className="w-full rounded-xl bg-[#2F73F0] py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {uploading ? 'Uploading…' : 'Upload RAMS'}
                </button>
              </form>
            </FeatureCard>
          )}
          <FeatureSectionLabel>RAMS documents</FeatureSectionLabel>
          {data.ramsDocuments.length === 0 ? (
            <EmptyState title="No RAMS" description="Upload RAMS for this job." />
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
          {isManager && showAddOther && (
            <FeatureCard className="p-4">
              <p className="mb-3 text-sm font-bold text-slate-900">Upload H&S document</p>
              <form onSubmit={addOther} className="space-y-3">
                <FormInput value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} placeholder="Title" required />
                <FormSelect value={otherCategory} onChange={(e) => setOtherCategory(e.target.value)}>
                  {['General', 'Policy', 'Method Statement', 'Certificate', 'Insurance'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </FormSelect>
                <input type="file" accept=".pdf,image/*" onChange={(e) => setOtherFile(e.target.files?.[0] || null)} className="text-sm" />
                <button type="submit" disabled={uploading} className="w-full rounded-xl bg-[#2F73F0] py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {uploading ? 'Uploading…' : 'Add document'}
                </button>
              </form>
            </FeatureCard>
          )}
          <FeatureSectionLabel>Other documents</FeatureSectionLabel>
          {data.otherDocuments.length === 0 ? (
            <EmptyState title="No other documents" description="Upload policies and supporting H&S files." />
          ) : (
            <FeatureCard>
              {data.otherDocuments.map((doc) => (
                <DocListRow
                  key={doc.id}
                  title={doc.title}
                  meta={`${doc.category} · ${format(doc.uploadedAt, 'd MMM yyyy')}`}
                  fileURL={doc.fileURL}
                />
              ))}
            </FeatureCard>
          )}
        </div>
      )}

      {showIssue && (
        <Modal title="Issue toolbox talk" onClose={() => setShowIssue(false)}>
          <FormSelect value={issueTalkId} onChange={(e) => setIssueTalkId(e.target.value)}>
            <option value="">Select talk</option>
            {data.talks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </FormSelect>
          <p className="mt-3 text-xs font-bold uppercase text-slate-400">Recipients</p>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {operativeUsers.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={issueRecipients.includes(u.id)}
                  onChange={() => toggleRecipient(u.id)}
                />
                {`${u.firstName} ${u.surname}`.trim() || u.email}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={submitIssue}
            disabled={!issueTalkId || issueRecipients.length === 0}
            className="mt-4 w-full rounded-xl bg-[#0fae9e] py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Issue now
          </button>
        </Modal>
      )}

      {showUploadTalk && (
        <Modal title="Upload toolbox talk" onClose={() => setShowUploadTalk(false)}>
          <form onSubmit={submitUploadTalk} className="space-y-3">
            <FormInput value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Title" required />
            <FormTextarea value={uploadPurpose} onChange={(e) => setUploadPurpose(e.target.value)} placeholder="Purpose" rows={3} />
            <button type="submit" className="w-full rounded-xl bg-[#2F73F0] py-2.5 text-sm font-bold text-white">
              Save to library
            </button>
          </form>
        </Modal>
      )}

      {showScheduled && (
        <Modal title="Schedule toolbox talk" onClose={() => setShowScheduled(false)}>
          <FormSelect value={scheduleTalkId} onChange={(e) => setScheduleTalkId(e.target.value)}>
            <option value="">Select talk</option>
            {data.talks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </FormSelect>
          <FormInput
            type="datetime-local"
            value={schedulePublishAt}
            onChange={(e) => setSchedulePublishAt(e.target.value)}
            className="mt-3"
          />
          <p className="mt-3 text-xs font-bold uppercase text-slate-400">Recipients</p>
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {operativeUsers.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scheduleRecipients.includes(u.id)}
                  onChange={() => toggleScheduleRecipient(u.id)}
                />
                {`${u.firstName} ${u.surname}`.trim() || u.email}
              </label>
            ))}
          </div>
          {scheduledIssues.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-400">Scheduled ({scheduledIssues.length})</p>
              {scheduledIssues.map((issue) => (
                <p key={issue.id} className="mt-1 text-xs text-slate-600">
                  {data.talks.find((t) => t.id === issue.talkId)?.title} ·{' '}
                  {issue.publishAt ? format(issue.publishAt, 'd MMM yyyy HH:mm') : '—'}
                </p>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={submitSchedule}
            disabled={!scheduleTalkId || scheduleRecipients.length === 0 || !schedulePublishAt}
            className="mt-4 w-full rounded-xl bg-[#2F73F0] py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Schedule
          </button>
        </Modal>
      )}

      {signIssue && (
        <Modal title="Sign toolbox talk" onClose={() => { setSignIssue(null); setSignatureB64(null) }}>
          <p className="mb-3 text-sm text-slate-600">
            {data.talks.find((t) => t.id === signIssue.talkId)?.title}
          </p>
          <SignaturePad onChange={setSignatureB64} />
          <button
            type="button"
            disabled={!signatureB64 || signing}
            onClick={submitSign}
            className="mt-4 w-full rounded-xl bg-[#0fae9e] py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {signing ? 'Saving…' : 'Confirm signature'}
          </button>
        </Modal>
      )}
    </FeatureScreen>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-base font-bold text-slate-900">{title}</p>
          <button type="button" onClick={onClose} className="text-slate-400">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
