'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChatBubbleLeftIcon, ChevronUpIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { feedbackWriteError, hasVoted, useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { similarSuggestions } from '@/lib/feedback/similar'
import {
  FEEDBACK_CATEGORIES,
  PUBLIC_STATUS_COPY,
  PUBLIC_STATUS_LABEL,
  type FeedbackCategory,
  type FeedbackSuggestion,
  type RelatedFeature,
} from '@/lib/feedback/types'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { Hero } from '@/components/ui/surfaces'

const CATEGORY_FEATURE: Record<FeedbackCategory, RelatedFeature> = {
  Projects: 'projects',
  'Small works': 'small_works',
  Scheduling: 'schedule',
  Tasks: 'tasks',
  Materials: 'materials',
  'Health & safety': 'health_safety',
  Timesheets: 'timesheets',
  Reports: 'reports',
  Users: 'users',
  Mobile: 'dashboard',
  Other: 'dashboard',
}

function orgLabel(row: FeedbackSuggestion): string {
  return row.organizationName?.trim() || 'An organisation'
}

function postedWhen(row: FeedbackSuggestion): string {
  return row.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function FeedbackBoardScreen() {
  const { user, organization } = useAuthStore()
  const { suggestions, votes, loading, error, loadBoard, toggleVote, submitIdea } = useFeedbackStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'All' | FeedbackCategory>('All')
  const [compose, setCompose] = useState(false)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [newCategory, setNewCategory] = useState<FeedbackCategory>('Other')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [voteError, setVoteError] = useState('')

  useEffect(() => {
    void loadBoard(false)
  }, [loadBoard])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return suggestions.filter((row) => {
      if (row.mergedIntoId) return false
      if (category !== 'All' && row.category !== category) return false
      if (!q) return true
      return `${row.title} ${row.details} ${row.organizationName || ''}`.toLowerCase().includes(q)
    })
  }, [suggestions, query, category])

  const featured = useMemo(() => {
    if (query.trim() || category !== 'All') return null
    const open = suggestions.filter((row) => !row.mergedIntoId && !row.hidden)
    if (open.length === 0) return null
    return [...open].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.voteCount - a.voteCount ||
        b.commentCount - a.commentCount ||
        b.createdAt.getTime() - a.createdAt.getTime()
    )[0]
  }, [suggestions, query, category])

  const similar = useMemo(
    () => similarSuggestions(title, details, suggestions),
    [title, details, suggestions]
  )

  const vote = async (row: FeedbackSuggestion) => {
    if (!user) return
    setVoteError('')
    try {
      await toggleVote(row, user.id)
    } catch (err) {
      setVoteError(feedbackWriteError(err))
    }
  }

  const submit = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    setSubmitError('')
    try {
      const id = await submitIdea({
        title,
        details,
        category: newCategory,
        relatedFeature: CATEGORY_FEATURE[newCategory],
        userId: user.id,
        authorName: `${user.firstName} ${user.surname}`.trim() || user.email,
        organizationId: organization?.id || user.organizationId,
        organizationName: organization?.name,
      })
      setSavedId(id)
      setTitle('')
      setDetails('')
      setCompose(false)
    } catch (err) {
      setSubmitError(feedbackWriteError(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading && suggestions.length === 0) return <LoadingSpinner label="Loading ideas…" />

  return (
    <div className="stack" data-hue="task">
      <Hero
        hue="task"
        eyebrow="Shared across every organisation"
        title="Vote the most useful idea to the top"
        subtitle="This board is the same for every company using Project Planner. Suggest an improvement, vote once per idea, and the highest-rated request is featured so the product team can see what matters on site."
        stats={[
          { label: 'Ideas on the board', value: suggestions.filter((row) => !row.mergedIntoId).length },
          { label: 'Votes cast', value: votes.length },
        ]}
        actions={
          <button type="button" className="btn sm hbtn solid" onClick={() => { setCompose(true); setSubmitError('') }}>
            Suggest an idea
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {voteError ? <ErrorBanner message={voteError} /> : null}
      {savedId ? (
        <div className="banner" data-hue="hs">
          Thanks — your idea is on the shared board.{' '}
          <Link href={`/dashboard/ideas/${savedId}`} className="font-semibold underline">
            Open it
          </Link>
        </div>
      ) : null}

      {featured ? (
        <article className="card pad" data-hue="task">
          <p className="eyebrow">Top rated</p>
          <div className="mt-2 flex items-start gap-3">
            <VoteControl
              row={featured}
              voted={hasVoted(votes, featured.id, user?.id)}
              onVote={() => void vote(featured)}
              large
            />
            <div className="min-w-0 flex-1">
              <Link href={`/dashboard/ideas/${featured.id}`} className="text-lg font-extrabold text-[var(--ink)]">
                {featured.title}
              </Link>
              <p className="mt-1 line-clamp-3 text-sm text-[var(--ink2)]">
                {featured.details || 'No extra detail yet.'}
              </p>
              <p className="mt-2 text-xs text-[var(--ink3)]">
                {orgLabel(featured)} · {featured.authorName} · {featured.category} · {PUBLIC_STATUS_LABEL[featured.publicStatus]} ·{' '}
                {featured.commentCount} comments
              </p>
            </div>
          </div>
        </article>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ideas or organisations…"
          className="pp-in min-w-[220px] flex-1"
        />
        {(['All', ...FEEDBACK_CATEGORIES] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`chip ${category === item ? 'on' : ''}`}
          >
            {item}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No ideas yet"
          description="Be the first organisation to suggest something, or clear the filters. Everyone on Project Planner will see it."
        />
      ) : (
        <div className="space-y-2">
          {visible.map((row) => {
            const voted = hasVoted(votes, row.id, user?.id)
            return (
              <article key={row.id} className="card pad">
                <div className="flex items-start gap-3">
                  <VoteControl row={row} voted={voted} onVote={() => void vote(row)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/dashboard/ideas/${row.id}`} className="text-base font-bold text-[var(--ink)]">
                        {row.title}
                      </Link>
                      {row.pinned ? (
                        <span className="pill" data-hue="task">
                          Pinned
                        </span>
                      ) : null}
                      {featured && row.id === featured.id ? (
                        <span className="pill" data-hue="hs">
                          Top rated
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--ink2)]">{row.details || 'No extra detail yet.'}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-[var(--ink3)]">
                      <span>{orgLabel(row)}</span>
                      <span>·</span>
                      <span>{row.category}</span>
                      <span>·</span>
                      <span>{PUBLIC_STATUS_LABEL[row.publicStatus]}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <ChatBubbleLeftIcon className="h-3 w-3" />
                        {row.commentCount}
                      </span>
                      <span>·</span>
                      <span>{postedWhen(row)}</span>
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {compose ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--bg)] p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                className="text-sm font-semibold text-[var(--blue)]"
                onClick={() => setCompose(false)}
              >
                Cancel
              </button>
              <p className="text-sm font-bold">Suggest an idea</p>
              <span className="w-12" />
            </div>
            <p className="text-sm text-[var(--ink2)]">
              Posted from {organization?.name || 'your organisation'} onto the shared board. Every company can see and vote on it.
            </p>
            {submitError ? <div className="mt-3"><ErrorBanner message={submitError} /></div> : null}
            <label className="eyebrow mt-3 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="pp-in mt-1"
              placeholder="What should we add or improve?"
            />
            <label className="eyebrow mt-3 block">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="pp-in mt-1 min-h-[120px]"
              placeholder="How would this help on a live job?"
            />
            <label className="eyebrow mt-3 block">Category</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEEDBACK_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setNewCategory(item)}
                  className={`chip ${newCategory === item ? 'on' : ''}`}
                >
                  {item}
                </button>
              ))}
            </div>
            {similar.length > 0 ? (
              <div className="mt-4">
                <p className="eyebrow">Similar ideas already on the board</p>
                <div className="mt-2 space-y-2">
                  {similar.map((row) => (
                    <Link
                      key={row.id}
                      href={`/dashboard/ideas/${row.id}`}
                      className="block rounded-xl bg-white p-3 text-sm font-semibold"
                    >
                      {row.title}
                      <span className="mt-1 block text-xs font-normal text-[var(--ink3)]">
                        {row.voteCount} votes · {orgLabel(row)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="btn primary mt-4 w-full"
              disabled={!title.trim() || saving}
              onClick={() => void submit()}
            >
              {saving ? 'Saving…' : 'Submit idea'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function VoteControl({
  row,
  voted,
  onVote,
  large,
}: {
  row: FeedbackSuggestion
  voted: boolean
  onVote: () => void
  large?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onVote}
      className={`flex flex-col items-center rounded-xl px-2 py-2 text-sm font-extrabold ${
        large ? 'min-w-[64px] py-3 text-lg' : 'min-w-[56px]'
      } ${voted ? 'bg-[var(--task-t)] text-[var(--task)]' : 'bg-[var(--soft)] text-[var(--ink2)]'}`}
      aria-label={voted ? 'Remove vote' : 'Vote for this idea'}
    >
      <ChevronUpIcon className={large ? 'h-5 w-5' : 'h-4 w-4'} />
      {row.voteCount}
      <span className="text-[10px] font-semibold uppercase">{voted ? 'Voted' : 'Vote'}</span>
    </button>
  )
}

export { CATEGORY_FEATURE, PUBLIC_STATUS_COPY }
