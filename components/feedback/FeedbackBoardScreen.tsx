'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChatBubbleLeftIcon, ChevronUpIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { feedbackWriteError, hasVoted, useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { similarSuggestions } from '@/lib/feedback/similar'
import { trendingScore } from '@/lib/feedback/serialize'
import {
  CATEGORY_FEATURE,
  CUSTOMER_STATUS_COPY,
  CUSTOMER_STATUS_LABEL,
  FEEDBACK_CATEGORIES,
  PUBLIC_STATUS_COPY,
  roleLabel,
  suggestCategoryFromText,
  unifiedStatus,
  validateIdeaDetails,
  validateIdeaTitle,
  type FeedbackCategory,
  type FeedbackImportance,
  type FeedbackStatus,
  type FeedbackSuggestion,
} from '@/lib/feedback/types'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { trackEvent } from '@/lib/analytics/trackEvent'

type BoardTab = 'ideas' | 'roadmap' | 'whats_new'
type SortMode = 'trending' | 'top' | 'new'
type MineFilter = 'all' | 'mine' | 'voted' | 'following'
type StatusFilter = 'all' | FeedbackStatus

const PAGE = 20

function relativeTime(date: Date): string {
  const delta = Date.now() - date.getTime()
  const minutes = Math.round(delta / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function authorLine(row: FeedbackSuggestion, userId?: string, orgId?: string): string {
  if (row.authorUserId === userId) return 'Posted by you'
  if (row.organizationId && orgId && row.organizationId === orgId) return 'Posted by your team'
  if (row.showCompanyName && row.organizationName?.trim()) return `Posted by ${row.organizationName.trim()}`
  return `Posted by ${roleLabel(row.authorRole)}`
}

function isNewIdea(row: FeedbackSuggestion, now = Date.now()): boolean {
  return now - row.createdAt.getTime() <= 7 * 86_400_000
}

function isHot(row: FeedbackSuggestion, ranked: FeedbackSuggestion[]): boolean {
  return ranked.slice(0, 5).some((item) => item.id === row.id) && row.voteCount >= 3
}

export function FeedbackBoardScreen() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { suggestions, votes, follows, loading, error, loadBoard, toggleVote, submitIdea } = useFeedbackStore()
  const [tab, setTab] = useState<BoardTab>('ideas')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'All' | FeedbackCategory>('All')
  const [sort, setSort] = useState<SortMode>('trending')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [mine, setMine] = useState<MineFilter>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE)
  const [compose, setCompose] = useState(false)
  const [voteError, setVoteError] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)

  useEffect(() => {
    void loadBoard(false)
    if (user?.id) void trackEvent('feedback_board_viewed', { userId: user.id, organizationId: organization?.id })
  }, [loadBoard, user?.id, organization?.id])

  const openIdeas = useMemo(
    () => suggestions.filter((row) => !row.hidden && !row.mergedIntoId),
    [suggestions]
  )

  const rankedTrending = useMemo(
    () => [...openIdeas].sort((a, b) => trendingScore(b, votes) - trendingScore(a, votes) || b.voteCount - a.voteCount),
    [openIdeas, votes]
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = openIdeas.filter((row) => {
      if (category !== 'All' && row.category !== category) return false
      const current = unifiedStatus(row)
      if (status === 'all') {
        if (current === 'not_planned' || current === 'merged') return false
      } else if (current !== status) {
        return false
      }
      if (mine === 'mine' && row.authorUserId !== user?.id) return false
      if (mine === 'voted' && !hasVoted(votes, row.id, user?.id)) return false
      if (mine === 'following' && !follows.includes(row.id)) return false
      if (!q) return true
      return `${row.title} ${row.details} ${row.category}`.toLowerCase().includes(q)
    })
    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned)
      if (sort === 'top') return b.voteCount - a.voteCount || b.createdAt.getTime() - a.createdAt.getTime()
      if (sort === 'new') return b.createdAt.getTime() - a.createdAt.getTime()
      return trendingScore(b, votes) - trendingScore(a, votes) || b.voteCount - a.voteCount
    })
    return list
  }, [openIdeas, query, category, status, mine, sort, votes, follows, user?.id])

  const page = visible.slice(0, visibleCount)
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of openIdeas) counts.set(row.category, (counts.get(row.category) || 0) + 1)
    return counts
  }, [openIdeas])

  const shipped = useMemo(
    () =>
      suggestions
        .filter((row) => unifiedStatus(row) === 'shipped' && !row.hidden)
        .sort((a, b) => (b.shippedAt || b.updatedAt).getTime() - (a.shippedAt || a.updatedAt).getTime()),
    [suggestions]
  )

  const impact = useMemo(() => {
    const posted = openIdeas.filter((row) => row.authorUserId === user?.id).length
    const voted = votes.filter((vote) => vote.userId === user?.id).length
    const backedShipped = shipped.filter((row) => hasVoted(votes, row.id, user?.id)).length
    return { posted, voted, backedShipped }
  }, [openIdeas, votes, shipped, user?.id])

  const vote = async (row: FeedbackSuggestion) => {
    if (!user) return
    setVoteError('')
    try {
      await toggleVote(row, user.id)
    } catch (err) {
      setVoteError(feedbackWriteError(err))
    }
  }

  if (loading && suggestions.length === 0 && !error) return <LoadingSpinner label="Loading feedback…" />

  return (
    <div className="space-y-4" data-hue="task">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight text-[var(--ink)]">Feedback</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-[var(--ink3)]">
            Share ideas to improve Project Planner, vote on what matters to you, and see what we&apos;re building next.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => setCompose(true)}>
          Suggest an idea
        </button>
      </div>

      <div className="flex gap-1 border-b border-[var(--line)]">
        {(
          [
            ['ideas', 'Ideas', openIdeas.length],
            ['roadmap', 'Roadmap', openIdeas.filter((row) => ['planned', 'in_progress', 'shipped'].includes(unifiedStatus(row))).length],
            ['whats_new', "What's new", shipped.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold ${
              tab === id ? 'border-[var(--blue)] text-[var(--ink)]' : 'border-transparent text-[var(--ink3)]'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
            <span className="rounded-full bg-[var(--blue-t,rgba(37,99,235,.12))] px-2 text-[11px] font-bold text-[var(--blue)]">
              {count}
            </span>
          </button>
        ))}
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {voteError ? <ErrorBanner message={voteError} /> : null}
      {savedId ? (
        <div className="banner" data-hue="hs">
          Thanks — you&apos;ll get a notification when the status changes.{' '}
          <Link href={`/dashboard/ideas/${savedId}`} className="font-semibold underline">
            Open it
          </Link>
        </div>
      ) : null}

      {tab === 'ideas' ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 bg-[var(--bg)] py-2">
              <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm">
                <span className="sr-only">Search ideas</span>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setVisibleCount(PAGE)
                    if (user?.id) void trackEvent('feedback_search', { userId: user.id })
                  }}
                  placeholder="Search ideas…"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              <div className="flex rounded-2xl border border-[var(--line)] bg-white p-1 shadow-sm">
                {(['trending', 'top', 'new'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={sort === item}
                    className={`rounded-xl px-3 py-1.5 text-sm font-semibold capitalize ${
                      sort === item ? 'bg-[var(--blue)] text-white' : 'text-[var(--ink3)]'
                    }`}
                    onClick={() => setSort(item)}
                  >
                    {item === 'top' ? 'Top' : item === 'new' ? 'New' : 'Trending'}
                  </button>
                ))}
              </div>
              <select
                className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium shadow-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
              >
                <option value="all">All open</option>
                <option value="new">Under review</option>
                <option value="under_review">Under review</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="shipped">Shipped</option>
                <option value="not_planned">Not planned</option>
              </select>
              <select
                className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium shadow-sm"
                value={mine}
                onChange={(e) => setMine(e.target.value as MineFilter)}
              >
                <option value="all">Everyone</option>
                <option value="mine">My ideas</option>
                <option value="voted">Voted</option>
                <option value="following">Following</option>
              </select>
            </div>

            <div className="mb-4 mt-1 flex flex-wrap gap-2">
              {(['All', ...FEEDBACK_CATEGORIES] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={category === item}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    category === item
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                      : 'border-[var(--line)] bg-white text-[var(--ink2)]'
                  }`}
                  onClick={() => {
                    setCategory(item)
                    setVisibleCount(PAGE)
                  }}
                >
                  {item}
                  {item !== 'All' ? (
                    <small className="ml-1 opacity-70">{categoryCounts.get(item) || 0}</small>
                  ) : null}
                </button>
              ))}
            </div>

            {page.length === 0 ? (
              <EmptyState
                title={openIdeas.length === 0 ? 'No ideas yet' : 'No ideas match these filters'}
                description={
                  openIdeas.length === 0
                    ? 'Be the first to suggest something that would make site life easier.'
                    : 'Clear the filters or search a different phrase.'
                }
              />
            ) : (
              <div className="space-y-3">
                {page.map((row) => {
                  const voted = hasVoted(votes, row.id, user?.id)
                  const current = unifiedStatus(row)
                  return (
                    <article
                      key={row.id}
                      className={`relative rounded-[22px] border bg-white p-4 shadow-sm transition hover:border-[color-mix(in_srgb,var(--blue)_45%,var(--line))] ${
                        row.pinned ? 'border-[color-mix(in_srgb,var(--blue)_50%,var(--line))]' : 'border-[var(--line)]'
                      }`}
                    >
                      <Link href={`/dashboard/ideas/${row.id}`} className="absolute inset-0 rounded-[22px]" aria-label={row.title} />
                      <div className="flex items-start gap-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            void vote(row)
                          }}
                          aria-pressed={voted}
                          aria-label={`Vote for ${row.title}, ${row.voteCount} votes`}
                          className={`relative z-[1] flex min-h-[72px] w-16 flex-col items-center justify-center rounded-2xl border text-lg font-extrabold ${
                            voted
                              ? 'border-[var(--blue)] bg-[var(--blue)] text-white'
                              : 'border-[var(--line)] bg-[var(--soft)] text-[var(--ink)]'
                          }`}
                        >
                          <ChevronUpIcon className="h-4 w-4" />
                          {row.voteCount}
                          <span className="text-[11px] font-semibold">{voted ? 'Voted' : 'Vote'}</span>
                        </button>
                        <div className="min-w-0 flex-1">
                          {row.pinned ? (
                            <p className="mb-1 text-xs font-semibold text-[var(--blue)]">📌 Pinned by the product team</p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="line-clamp-2 text-[17px] font-bold tracking-tight text-[var(--ink)]">{row.title}</h2>
                            {isHot(row, rankedTrending) ? (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">🔥 Trending</span>
                            ) : null}
                            {row.officialResponse ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">
                                Product team replied
                              </span>
                            ) : null}
                            {isNewIdea(row) ? (
                              <span className="rounded-full bg-[var(--soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink2)]">New</span>
                            ) : null}
                            {row.organizationId && row.organizationId === organization?.id ? (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">Your team</span>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-[var(--ink2)]">{row.details || 'No extra detail yet.'}</p>
                          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ink3)]">
                            <span className="rounded-full border border-[var(--line)] bg-[var(--soft)] px-2 py-0.5 font-semibold text-[var(--ink2)]">
                              {row.category}
                            </span>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                              {CUSTOMER_STATUS_LABEL[current]}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
                              {row.commentCount}
                            </span>
                            <span>{relativeTime(row.createdAt)}</span>
                            <span>{authorLine(row, user?.id, organization?.id)}</span>
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                })}
                {visible.length > page.length ? (
                  <button type="button" className="btn ghost w-full" onClick={() => setVisibleCount((count) => count + PAGE)}>
                    Load more
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <aside className="hidden space-y-3 xl:block">
            <section className="rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold">Your impact</h3>
              <p className="mt-2 text-sm text-[var(--ink2)]">
                {impact.posted} idea{impact.posted === 1 ? '' : 's'} posted · {impact.voted} vote{impact.voted === 1 ? '' : 's'}{' '}
                cast · {impact.backedShipped} you backed {impact.backedShipped === 1 ? 'has' : 'have'} shipped
              </p>
            </section>
            <section className="rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold">Recently shipped</h3>
              {shipped.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ink3)]">Nothing shipped yet — vote to help us choose.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {shipped.slice(0, 3).map((row) => (
                    <li key={row.id}>
                      <Link href={`/dashboard/ideas/${row.id}`} className="text-sm font-semibold text-[var(--blue)]">
                        {row.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold">How this works</h3>
              <p className="mt-2 text-sm text-[var(--ink3)]">
                One vote per person per idea. The product team replies on the board. Names from other companies stay private.
              </p>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === 'roadmap' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['planned', 'Planned'],
              ['in_progress', 'Building'],
              ['shipped', 'Shipped recently'],
            ] as const
          ).map(([id, label]) => {
            const cards = openIdeas.filter((row) => unifiedStatus(row) === id).slice(0, 12)
            return (
              <section key={id} className="rounded-[22px] border border-[var(--line)] bg-[var(--soft)] p-3">
                <h2 className="mb-3 flex items-center justify-between text-sm font-bold">
                  {label}
                  <span className="text-xs text-[var(--ink3)]">{cards.length}</span>
                </h2>
                {cards.length === 0 ? <p className="text-sm text-[var(--ink3)]">Nothing here yet.</p> : null}
                {cards.map((row) => (
                  <Link key={row.id} href={`/dashboard/ideas/${row.id}`} className="mb-2 block rounded-2xl border border-[var(--line)] bg-white p-3">
                    <p className="text-sm font-bold">{row.title}</p>
                    <p className="mt-1 text-xs text-[var(--ink3)]">{row.voteCount} votes · {row.category}</p>
                  </Link>
                ))}
              </section>
            )
          })}
        </div>
      ) : null}

      {tab === 'whats_new' ? (
        <div className="space-y-3">
          {shipped.length === 0 ? (
            <EmptyState title="No shipped ideas yet" description="When we release something you asked for, it will land here." />
          ) : (
            shipped.map((row) => (
              <article key={row.id} className="rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-[var(--ink3)]">
                  {(row.shippedAt || row.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <Link href={`/dashboard/ideas/${row.id}`} className="mt-1 block text-lg font-bold">
                  {row.title}
                </Link>
                <p className="mt-1 text-sm text-[var(--ink2)]">{row.releaseNote || row.officialResponse || row.details}</p>
                {hasVoted(votes, row.id, user?.id) ? (
                  <p className="mt-2 text-xs font-bold text-green-700">You asked for this</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : null}

      {compose ? (
        <ComposeModal
          onClose={() => setCompose(false)}
          onSaved={(id) => {
            setSavedId(id)
            setCompose(false)
            router.push(`/dashboard/ideas/${id}`)
          }}
        />
      ) : null}
    </div>
  )
}

function ComposeModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { user, organization } = useAuthStore()
  const { suggestions, submitIdea, toggleVote } = useFeedbackStore()
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>('Other')
  const [importance, setImportance] = useState<FeedbackImportance>('important')
  const [showCompanyName, setShowCompanyName] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [continueAnyway, setContinueAnyway] = useState(false)

  const similar = useMemo(() => similarSuggestions(title, details, suggestions), [title, details, suggestions])
  const titleError = title.trim() ? validateIdeaTitle(title) : 'Title needs at least 8 characters.'
  const detailsError = details.trim() ? validateIdeaDetails(details) : 'Describe the problem in at least 20 characters.'

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (similar.length > 0 && user?.id) void trackEvent('idea_similar_shown', { userId: user.id })
    }, 300)
    const suggested = suggestCategoryFromText(`${title} ${details}`)
    if (suggested !== 'Other') setCategory(suggested)
    return () => window.clearTimeout(handle)
  }, [title, details, similar.length, user?.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!user || titleError || detailsError) return
    setSaving(true)
    setSubmitError('')
    try {
      const id = await submitIdea({
        title,
        details,
        category,
        relatedFeature: CATEGORY_FEATURE[category],
        userId: user.id,
        authorName: `${user.firstName} ${user.surname}`.trim() || user.email,
        authorRole: user.role,
        organizationId: organization?.id || user.organizationId,
        organizationName: organization?.name,
        showCompanyName,
        importance,
      })
      onSaved(id)
    } catch (err) {
      setSubmitError(feedbackWriteError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--bg)] p-4 sm:rounded-2xl" role="dialog" aria-modal="true">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="text-sm font-semibold text-[var(--blue)]" onClick={onClose}>
            Cancel
          </button>
          <p className="text-sm font-bold">Suggest an idea</p>
          <span className="w-12" />
        </div>
        {submitError ? <ErrorBanner message={submitError} /> : null}
        <label className="eyebrow mt-2 block">What&apos;s the idea?</label>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setContinueAnyway(false)
          }}
          className="pp-in mt-1"
          maxLength={90}
          placeholder="A specific change that would help on site"
        />
        <p className="mt-1 text-xs text-[var(--ink3)]">{title.trim().length}/90 {titleError ? `· ${titleError}` : ''}</p>
        {similar.length > 0 && !continueAnyway ? (
          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white p-3">
            <p className="eyebrow">Similar ideas already on the board</p>
            <div className="mt-2 space-y-2">
              {similar.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--soft)] p-3">
                  <Link href={`/dashboard/ideas/${row.id}`} className="min-w-0 text-sm font-semibold">
                    {row.title}
                    <span className="mt-1 block text-xs font-normal text-[var(--ink3)]">
                      {row.voteCount} votes · {CUSTOMER_STATUS_LABEL[unifiedStatus(row)]}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="btn sm primary shrink-0"
                    onClick={() => {
                      if (!user) return
                      void trackEvent('idea_similar_chosen', { userId: user.id })
                      void toggleVote(row, user.id)
                      onClose()
                    }}
                  >
                    Vote instead
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-sm font-semibold text-[var(--blue)]" onClick={() => setContinueAnyway(true)}>
              None of these, it&apos;s different
            </button>
          </div>
        ) : null}
        {(continueAnyway || similar.length === 0) && title.trim().length >= 8 ? (
          <>
            <label className="eyebrow mt-3 block">What problem does this solve on site?</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="pp-in mt-1 min-h-[120px]"
              maxLength={2000}
              placeholder="e.g. On Monday mornings I can't see which operatives are on which job without scrolling…"
            />
            <p className="mt-1 text-xs text-[var(--ink3)]">{details.trim().length}/2000 {detailsError ? `· ${detailsError}` : ''}</p>
            <label className="eyebrow mt-3 block">Category</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEEDBACK_CATEGORIES.map((item) => (
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
            <label className="eyebrow mt-3 block">How important is this to you?</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ['nice', 'Nice to have'],
                  ['important', 'Important'],
                  ['blocking', 'Blocking my work'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={`chip ${importance === id ? 'on' : ''}`} onClick={() => setImportance(id)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showCompanyName} onChange={(e) => setShowCompanyName(e.target.checked)} />
              Show my company name on this idea
            </label>
            <button
              type="button"
              className="btn primary mt-4 w-full"
              disabled={Boolean(titleError || detailsError) || saving}
              onClick={() => void submit()}
            >
              {saving ? 'Saving…' : 'Submit idea'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export { CATEGORY_FEATURE, PUBLIC_STATUS_COPY, CUSTOMER_STATUS_COPY }
