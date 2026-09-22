'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { trendingScore } from '@/lib/feedback/serialize'
import {
  DECISION_HUE,
  DECISION_LABEL,
  FEEDBACK_CATEGORIES,
  PRODUCT_DECISIONS,
  PUBLIC_STATUS_LABEL,
  type FeedbackCategory,
  type ProductDecision,
} from '@/lib/feedback/types'
import { ideaPipeline } from '@/lib/analytics/aggregations'
import { DeveloperShell, DeveloperStatus, MetricCard } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'
import { CATEGORY_FEATURE } from '@/components/feedback/FeedbackBoardScreen'

type Filter = 'all' | 'trending' | 'voted' | 'review' | 'planned' | 'in_progress' | 'released' | 'declined'

export function DeveloperFeedbackScreen() {
  const search = useSearchParams()
  const initial = (search.get('filter') as Filter) || 'all'
  const [filter, setFilter] = useState<Filter>(initial)
  const [query, setQuery] = useState('')
  const [compose, setCompose] = useState(false)
  const { suggestions, votes, loading, error, loadBoard } = useFeedbackStore()

  useEffect(() => {
    void loadBoard(true)
  }, [loadBoard])

  const pipeline = ideaPipeline(suggestions)
  const open = suggestions.filter((row) => !row.mergedIntoId)
  const rows = useMemo(() => {
    let list = open
    switch (filter) {
      case 'trending':
        list = [...open].sort((a, b) => trendingScore(b, votes) - trendingScore(a, votes))
        break
      case 'voted':
        list = [...open].sort((a, b) => b.voteCount - a.voteCount)
        break
      case 'review':
        list = open.filter((row) => row.productDecision === 'none' && !row.hidden)
        break
      case 'planned':
        list = open.filter((row) => row.productDecision === 'build' || row.publicStatus === 'planned')
        break
      case 'in_progress':
        list = open.filter((row) => row.productDecision === 'in_progress' || row.publicStatus === 'in_progress')
        break
      case 'released':
        list = open.filter((row) => row.productDecision === 'released' || row.publicStatus === 'released')
        break
      case 'declined':
        list = open.filter((row) => row.productDecision === 'decline' || row.publicStatus === 'not_planned')
        break
      default:
        list = open
    }
    const needle = query.trim().toLowerCase()
    if (!needle) return list
    return list.filter((row) =>
      `${row.title} ${row.details} ${row.authorName} ${row.organizationName || ''} ${row.category}`.toLowerCase().includes(needle)
    )
  }, [open, votes, filter, query])

  if (loading && suggestions.length === 0 && !error) return <LoadingSpinner label="Loading feedback…" />

  return (
    <DeveloperShell
      title="Feedback"
      actions={
        <button type="button" className="btn sm primary" onClick={() => setCompose(true)}>
          Add feedback
        </button>
      }
    >
      <p className="text-sm text-[var(--ink2)]">
        Shared board for every organisation. Customers submit from Feedback in the app; you triage, merge and move cards
        onto the roadmap here.
      </p>
      <DeveloperStatus error={error} loading={loading && suggestions.length > 0} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open feedback" value={open.filter((row) => !row.hidden).length} />
        <MetricCard label="Awaiting review" value={pipeline.find((row) => row.id === 'none')?.count || 0} href="/developer/feedback?filter=review" />
        <MetricCard label="On the roadmap" value={(pipeline.find((row) => row.id === 'build')?.count || 0) + (pipeline.find((row) => row.id === 'in_progress')?.count || 0)} href="/developer/roadmap" />
        <MetricCard label="Votes" value={votes.length} />
      </div>
      <SearchField value={query} onChange={setQuery} placeholder="Search title, organisation or author" />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['trending', 'Trending'],
            ['voted', 'Most voted'],
            ['review', 'Needs review'],
            ['planned', 'Build'],
            ['in_progress', 'In progress'],
            ['released', 'Released'],
            ['declined', 'Declined'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {open.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          description="When someone submits from Feedback in their organisation app, it appears here. You can also add one with Add feedback."
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No matching feedback" description="Try a different filter or search." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link key={row.id} href={`/developer/feedback/${row.id}`} className="card pad block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{row.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--ink2)]">{row.details || 'No extra detail yet.'}</p>
                  <p className="mt-1 text-xs text-[var(--ink3)]">
                    {row.voteCount} votes · {row.commentCount} comments · {row.category} ·{' '}
                    {row.organizationName?.trim() || 'Unknown organisation'} · {row.authorName}
                  </p>
                </div>
                <span className="pill shrink-0" data-hue={DECISION_HUE[row.productDecision]}>
                  {DECISION_LABEL[row.productDecision]}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--ink3)]">{PUBLIC_STATUS_LABEL[row.publicStatus]}</p>
            </Link>
          ))}
        </div>
      )}
      {compose ? <OwnerIdeaComposer onClose={() => setCompose(false)} /> : null}
    </DeveloperShell>
  )
}

function OwnerIdeaComposer({ onClose }: { onClose: () => void }) {
  const { user, organization } = useAuthStore()
  const { submitIdea } = useFeedbackStore()
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>('Other')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const submit = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    setFormError('')
    try {
      await submitIdea({
        title,
        details,
        category,
        relatedFeature: CATEGORY_FEATURE[category],
        userId: user.id,
        authorName: `${user.firstName} ${user.surname}`.trim() || user.email,
        organizationId: organization?.id || user.organizationId,
        organizationName: organization?.name || 'Project Planner',
      })
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this feedback.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--bg)] p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="text-sm font-semibold text-[var(--blue)]" onClick={onClose}>
            Cancel
          </button>
          <p className="text-sm font-bold">Add feedback</p>
          <span className="w-12" />
        </div>
        {formError ? <p className="banner mb-3" data-hue="red">{formError}</p> : null}
        <label className="eyebrow mt-3 block">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="pp-in mt-1" placeholder="What should we add or improve?" />
        <label className="eyebrow mt-3 block">Details</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="pp-in mt-1 min-h-[120px]" />
        <label className="eyebrow mt-3 block">Category</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} className={`chip ${category === item ? 'on' : ''}`}>
              {item}
            </button>
          ))}
        </div>
        <button type="button" className="btn primary mt-4 w-full" disabled={!title.trim() || saving} onClick={() => void submit()}>
          {saving ? 'Saving…' : 'Save feedback'}
        </button>
      </div>
    </div>
  )
}

export function DeveloperRoadmapScreen() {
  const { suggestions, loading, error, loadBoard, updateAdmin } = useFeedbackStore()
  const { user } = useAuthStore()

  useEffect(() => {
    void loadBoard(true)
  }, [loadBoard])

  const columns: { id: ProductDecision; label: string }[] = [
    { id: 'none', label: 'Backlog' },
    { id: 'investigate', label: 'Investigate' },
    { id: 'build', label: 'Build' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'released', label: 'Released' },
  ]

  if (loading && suggestions.length === 0 && !error) return <LoadingSpinner label="Loading roadmap…" />

  const open = suggestions.filter((row) => !row.hidden && !row.mergedIntoId)

  return (
    <DeveloperShell title="Roadmap">
      <p className="text-sm text-[var(--ink2)]">
        Move customer feedback through product decisions. Backlog is everything still awaiting review. Declined feedback stays
        on Feedback, not on this board.
      </p>
      <DeveloperStatus error={error} loading={loading && suggestions.length > 0} />
      {open.length === 0 ? (
        <EmptyState
          title="Roadmap is empty"
          description="Feedback appears here once customers submit it, or after you add one yourself from Feedback."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {columns.map((column) => {
            const cards = open.filter((row) => row.productDecision === column.id)
            return (
              <section key={column.id} className="card pad">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="h2">{column.label}</h2>
                  <span className="text-xs font-bold text-[var(--ink3)]">{cards.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {cards.length === 0 ? <p className="text-xs text-[var(--ink3)]">Nothing in this column</p> : null}
                  {cards.map((row) => (
                    <div key={row.id} className="rounded-xl bg-[var(--soft)] p-3">
                      <Link href={`/developer/feedback/${row.id}`} className="text-sm font-bold">
                        {row.title}
                      </Link>
                      <p className="mt-1 text-xs text-[var(--ink3)]">
                        {row.voteCount} votes · {row.organizationName?.trim() || 'Unknown organisation'}
                      </p>
                      <select
                        className="pp-in mt-2 text-xs"
                        value={row.productDecision}
                        onChange={(e) => {
                          if (!user) return
                          void updateAdmin({
                            suggestion: row,
                            actorUserId: user.id,
                            actorName: `${user.firstName} ${user.surname}`.trim() || user.email,
                            patch: { productDecision: e.target.value as ProductDecision },
                          })
                        }}
                      >
                        {PRODUCT_DECISIONS.filter((item) => item !== 'decline').map((item) => (
                          <option key={item} value={item}>
                            {DECISION_LABEL[item]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </DeveloperShell>
  )
}
