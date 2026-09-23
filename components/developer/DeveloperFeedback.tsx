'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { trendingScore } from '@/lib/feedback/serialize'
import {
  CONSOLE_STATUS_LABEL,
  DECISION_HUE,
  DECISION_LABEL,
  FEEDBACK_CATEGORIES,
  PRODUCT_DECISIONS,
  CATEGORY_FEATURE,
  unifiedStatus,
  type FeedbackCategory,
  type ProductDecision,
} from '@/lib/feedback/types'
import { ideaPipeline } from '@/lib/analytics/aggregations'
import { DeveloperShell, DeveloperStatus, MetricCard } from '@/components/developer/DeveloperShell'
import { EmptyState, LoadingSpinner, SearchField } from '@/components/dashboard/PageShell'
import { similarSuggestionsScored } from '@/lib/feedback/similar'
import type { FeedbackSuggestion } from '@/lib/feedback/types'

type Filter = 'all' | 'trending' | 'voted' | 'review' | 'planned' | 'in_progress' | 'released' | 'declined'
type OwnerTab = 'board' | 'inbox' | 'insights'

export function DeveloperFeedbackScreen() {
  const search = useSearchParams()
  const initial = (search.get('filter') as Filter) || 'all'
  const [filter, setFilter] = useState<Filter>(initial)
  const [query, setQuery] = useState('')
  const [compose, setCompose] = useState(false)
  const [ownerTab, setOwnerTab] = useState<OwnerTab>(initial === 'review' ? 'inbox' : 'board')
  const { suggestions, votes, loading, error, loadBoard, updateAdmin } = useFeedbackStore()
  const { user } = useAuthStore()

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
        list = open.filter((row) => unifiedStatus(row) === 'new' && !row.hidden)
        break
      case 'planned':
        list = open.filter((row) => unifiedStatus(row) === 'planned')
        break
      case 'in_progress':
        list = open.filter((row) => unifiedStatus(row) === 'in_progress')
        break
      case 'released':
        list = open.filter((row) => unifiedStatus(row) === 'shipped')
        break
      case 'declined':
        list = open.filter((row) => unifiedStatus(row) === 'not_planned')
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
      <div className="flex gap-1 border-b border-[var(--line)]">
        {(
          [
            ['inbox', 'Inbox'],
            ['board', 'Board'],
            ['insights', 'Insights'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${
              ownerTab === id ? 'border-[var(--blue)] text-[var(--ink)]' : 'border-transparent text-[var(--ink3)]'
            }`}
            onClick={() => {
              setOwnerTab(id)
              if (id === 'inbox') setFilter('review')
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open feedback" value={open.filter((row) => !row.hidden).length} />
        <MetricCard label="Needs review" value={pipeline.find((row) => row.id === 'none')?.count || 0} href="/developer/feedback?filter=review" />
        <MetricCard label="On the roadmap" value={(pipeline.find((row) => row.id === 'build')?.count || 0) + (pipeline.find((row) => row.id === 'in_progress')?.count || 0)} href="/developer/roadmap" />
        <MetricCard label="Votes" value={votes.length} />
      </div>
      {ownerTab === 'insights' ? (
        <InsightsPanel suggestions={open} votes={votes} />
      ) : (
        <>
      <SearchField value={query} onChange={setQuery} placeholder="Search title, organisation or author" />
      {ownerTab === 'board' ? (
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['trending', 'Trending'],
            ['voted', 'Most voted'],
            ['review', 'Needs review'],
            ['planned', 'Planned'],
            ['in_progress', 'Building'],
            ['released', 'Released'],
            ['declined', 'Declined'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      ) : (
        <p className="text-xs text-[var(--ink3)]">
          Keyboard: A approve · D decline · H hide · J/K next. Oldest unreviewed ideas first.
        </p>
      )}
      {open.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          description="When someone submits from Feedback in their organisation app, it appears here. You can also add one with Add feedback."
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No matching feedback" description="Try a different filter or search." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const duplicate = similarSuggestionsScored(row.title, row.details, open.filter((item) => item.id !== row.id), 1)[0]
            return (
            <div key={row.id} className="card pad">
              <Link href={`/developer/feedback/${row.id}`} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{row.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--ink2)]">{row.details || 'No extra detail yet.'}</p>
                    <p className="mt-1 text-xs text-[var(--ink3)]">
                      {row.voteCount} votes · {row.commentCount} comments · {row.category} ·{' '}
                      {row.organizationName?.trim() || 'Unfinished setup'} · {row.authorName}
                    </p>
                    {duplicate ? (
                      <p className="mt-1 text-xs text-[var(--ink3)]">
                        Suggested duplicate: {duplicate.row.title} ({Math.round(duplicate.score * 100)}%)
                      </p>
                    ) : null}
                  </div>
                  <span className="pill shrink-0" data-hue={DECISION_HUE[row.productDecision]}>
                    {CONSOLE_STATUS_LABEL[unifiedStatus(row)]}
                  </span>
                </div>
              </Link>
              {ownerTab === 'inbox' && user ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={() =>
                      void updateAdmin({
                        suggestion: row,
                        actorUserId: user.id,
                        actorName: `${user.firstName} ${user.surname}`.trim() || user.email,
                        patch: { status: 'under_review' },
                      })
                    }
                  >
                    Approve
                  </button>
                  <Link href={`/developer/feedback/${row.id}`} className="btn sm ghost">
                    Merge
                  </Link>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() =>
                      void updateAdmin({
                        suggestion: row,
                        actorUserId: user.id,
                        actorName: `${user.firstName} ${user.surname}`.trim() || user.email,
                        patch: { status: 'not_planned' },
                      })
                    }
                  >
                    Not planned
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() =>
                      void updateAdmin({
                        suggestion: row,
                        actorUserId: user.id,
                        actorName: `${user.firstName} ${user.surname}`.trim() || user.email,
                        patch: { hidden: true },
                      })
                    }
                  >
                    Hide
                  </button>
                </div>
              ) : null}
            </div>
          )})}
        </div>
      )}
        </>
      )}
      {compose ? <OwnerIdeaComposer onClose={() => setCompose(false)} /> : null}
    </DeveloperShell>
  )
}

function InsightsPanel({
  suggestions,
  votes,
}: {
  suggestions: FeedbackSuggestion[]
  votes: { suggestionId: string }[]
}) {
  const byCategory = FEEDBACK_CATEGORIES.map((category) => ({
    category,
    ideas: suggestions.filter((row) => row.category === category).length,
    votes: suggestions.filter((row) => row.category === category).reduce((sum, row) => sum + row.voteCount, 0),
  }))
  const responded = suggestions.filter((row) => Boolean(row.officialResponse)).length
  const shipped = suggestions.filter((row) => unifiedStatus(row) === 'shipped').length
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Ideas submitted" value={suggestions.length} />
        <MetricCard label="Votes" value={votes.length} />
        <MetricCard
          label="Response health"
          value={suggestions.length ? `${Math.round((responded / suggestions.length) * 100)}%` : '—'}
          hint="Share of open ideas with an official response"
        />
      </div>
      <section className="card pad">
        <h2 className="h2">Demand by category</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {byCategory
            .filter((row) => row.ideas > 0)
            .sort((a, b) => b.votes - a.votes)
            .map((row) => (
              <li key={row.category} className="flex justify-between gap-3">
                <span>{row.category}</span>
                <span className="text-[var(--ink3)]">
                  {row.ideas} ideas · {row.votes} votes
                </span>
              </li>
            ))}
        </ul>
      </section>
      <p className="text-xs text-[var(--ink3)]">
        {shipped} shipped. Cycle time, deflection and MRR-at-stake need daily rollups (not yet computed on the client).
      </p>
    </div>
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
    { id: 'none', label: 'Needs review' },
    { id: 'investigate', label: 'Investigating' },
    { id: 'build', label: 'Planned' },
    { id: 'in_progress', label: 'Building' },
    { id: 'released', label: 'Released' },
  ]

  if (loading && suggestions.length === 0 && !error) return <LoadingSpinner label="Loading roadmap…" />

  const open = suggestions.filter((row) => !row.hidden && !row.mergedIntoId)

  return (
    <DeveloperShell title="Roadmap">
      <p className="text-sm text-[var(--ink2)]">
        Move customer feedback through the same status model customers see. Needs review is everything still awaiting
        triage. Declined feedback stays on Feedback, not on this board.
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
                        {row.voteCount} votes · {row.organizationName?.trim() || 'Unfinished setup'}
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
