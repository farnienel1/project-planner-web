'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useFeedbackStore, hasVoted } from '@/lib/feedback/feedbackStore'
import { similarSuggestions } from '@/lib/feedback/similar'
import {
  FEEDBACK_CATEGORIES,
  PUBLIC_STATUS_COPY,
  PUBLIC_STATUS_LABEL,
  type FeedbackCategory,
  type RelatedFeature,
} from '@/lib/feedback/types'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'

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

  useEffect(() => {
    void loadBoard(false)
  }, [loadBoard])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return suggestions.filter((row) => {
      if (row.mergedIntoId) return false
      if (category !== 'All' && row.category !== category) return false
      if (!q) return true
      return `${row.title} ${row.details}`.toLowerCase().includes(q)
    })
  }, [suggestions, query, category])

  const similar = useMemo(
    () => similarSuggestions(title, details, suggestions),
    [title, details, suggestions]
  )

  const submit = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    try {
      const id = await submitIdea({
        title,
        details,
        category: newCategory,
        relatedFeature: CATEGORY_FEATURE[newCategory],
        userId: user.id,
        authorName: `${user.firstName} ${user.surname}`.trim() || user.email,
        organizationId: organization?.id || user.organizationId,
      })
      setSavedId(id)
      setTitle('')
      setDetails('')
      setCompose(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading && suggestions.length === 0) return <LoadingSpinner label="Loading ideas…" />

  return (
    <div className="space-y-4">
      <section className="hero" data-hue="task" style={{ padding: '22px 24px' }}>
        <p className="eb">Ideas</p>
        <div className="big">Suggest and vote</div>
        <p style={{ opacity: 0.9, marginTop: 6, maxWidth: 560 }}>
          Tell the product team what would help on site. Vote on existing ideas so the most useful work rises to the top.
        </p>
        <button type="button" className="btn sm hbtn solid mt-4" onClick={() => setCompose(true)}>
          Suggest an idea
        </button>
      </section>

      {error ? <ErrorBanner message={error} /> : null}
      {savedId ? (
        <div className="banner" data-hue="hs">
          Thanks — your idea is on the board.{' '}
          <Link href={`/dashboard/ideas/${savedId}`} className="font-semibold underline">
            Open it
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ideas…"
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
        <EmptyState title="No ideas yet" description="Be the first to suggest something, or clear the filters." />
      ) : (
        <div className="space-y-2">
          {visible.map((row) => {
            const voted = hasVoted(votes, row.id, user?.id)
            return (
              <article key={row.id} className="card pad">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => void toggleVote(row, user!.id)}
                    className={`flex min-w-[56px] flex-col items-center rounded-xl px-2 py-2 text-sm font-extrabold ${
                      voted ? 'bg-[var(--task-t)] text-[var(--task)]' : 'bg-[var(--soft)] text-[var(--ink2)]'
                    }`}
                  >
                    {row.voteCount}
                    <span className="text-[10px] font-semibold uppercase">{voted ? 'Voted' : 'Vote'}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/ideas/${row.id}`} className="text-base font-bold text-[var(--ink)]">
                      {row.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--ink2)]">{row.details || 'No extra detail yet.'}</p>
                    <p className="mt-2 text-xs text-[var(--ink3)]">
                      {row.category} · {PUBLIC_STATUS_LABEL[row.publicStatus]} · {row.commentCount} comments
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
              <button type="button" className="text-sm font-semibold text-[var(--blue)]" onClick={() => setCompose(false)}>
                Cancel
              </button>
              <p className="text-sm font-bold">Suggest an idea</p>
              <span className="w-12" />
            </div>
            <label className="eyebrow">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="pp-in mt-1" placeholder="What should we add or improve?" />
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
                    <Link key={row.id} href={`/dashboard/ideas/${row.id}`} className="block rounded-xl bg-white p-3 text-sm font-semibold">
                      {row.title}
                      <span className="mt-1 block text-xs font-normal text-[var(--ink3)]">{row.voteCount} votes</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <button type="button" className="btn primary mt-4 w-full" disabled={!title.trim() || saving} onClick={() => void submit()}>
              {saving ? 'Saving…' : 'Submit idea'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { CATEGORY_FEATURE, PUBLIC_STATUS_COPY }
