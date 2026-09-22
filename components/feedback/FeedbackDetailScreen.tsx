'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChatBubbleLeftIcon, ChevronUpIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { feedbackWriteError, hasVoted, useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { similarSuggestions } from '@/lib/feedback/similar'
import {
  CUSTOMER_STATUS_COPY,
  CUSTOMER_STATUS_LABEL,
  roleLabel,
  unifiedStatus,
  type FeedbackSuggestion,
} from '@/lib/feedback/types'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { trackEvent } from '@/lib/analytics/trackEvent'

function authorLine(row: FeedbackSuggestion, userId?: string, orgId?: string): string {
  if (row.authorUserId === userId) return 'Posted by you'
  if (row.organizationId && orgId && row.organizationId === orgId) return 'Posted by your team'
  if (row.showCompanyName && row.organizationName?.trim()) return `Posted by ${row.organizationName.trim()}`
  return `Posted by ${roleLabel(row.authorRole)}`
}

export function FeedbackDetailScreen({ ideaId }: { ideaId: string }) {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const {
    suggestions,
    votes,
    comments,
    history,
    follows,
    loading,
    error,
    loadBoard,
    loadSuggestionExtras,
    toggleVote,
    toggleFollow,
    addComment,
    editComment,
    deleteComment,
  } = useFeedbackStore()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [sortNewest, setSortNewest] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  useEffect(() => {
    void loadBoard(false).then(() => loadSuggestionExtras(ideaId, false))
  }, [ideaId, loadBoard, loadSuggestionExtras])

  const suggestion = suggestions.find((row) => row.id === ideaId)
  const merged = suggestion?.mergedIntoId
    ? suggestions.find((row) => row.id === suggestion.mergedIntoId)
    : undefined

  useEffect(() => {
    if (merged) {
      const timer = window.setTimeout(() => router.replace(`/dashboard/ideas/${merged.id}`), 3000)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [merged, router])

  useEffect(() => {
    if (suggestion && user?.id) void trackEvent('idea_viewed', { userId: user.id, organizationId: organization?.id })
  }, [suggestion?.id, user?.id, organization?.id, suggestion])

  const related = useMemo(() => {
    if (!suggestion) return []
    return similarSuggestions(suggestion.title, suggestion.details, suggestions.filter((row) => row.id !== suggestion.id), 3)
  }, [suggestion, suggestions])

  if (loading && !suggestion) return <LoadingSpinner />
  if (!suggestion) {
    return (
      <EmptyState
        title="This idea isn’t available"
        description="It may have been hidden. Go back to the board and pick another."
      />
    )
  }

  const voted = hasVoted(votes, suggestion.id, user?.id)
  const following = follows.includes(suggestion.id)
  const current = unifiedStatus(suggestion)
  const ideaComments = comments
    .filter((comment) => comment.suggestionId === suggestion.id && !comment.deleted)
    .sort((a, b) => (sortNewest ? b.createdAt.getTime() - a.createdAt.getTime() : a.createdAt.getTime() - b.createdAt.getTime()))
  const statusHistory = history
    .filter((entry) => entry.suggestionId === suggestion.id && (entry.field === 'status' || entry.field === 'publicStatus' || entry.field === 'productDecision'))
    .slice()
    .reverse()
  const orgCount = suggestion.orgCount || 1
  const wanted = `Wanted by ${suggestion.voteCount} ${suggestion.voteCount === 1 ? 'person' : 'people'} across ${orgCount} ${orgCount === 1 ? 'company' : 'companies'}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      setActionError('Could not copy the link.')
    }
  }

  return (
    <div className="stack space-y-4" data-hue="task">
      <Link href="/dashboard/ideas" className="btn sm ghost w-fit">
        ← Back to ideas
      </Link>
      {error ? <ErrorBanner message={error} /> : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}
      {merged ? (
        <div className="banner" data-hue="task">
          This idea was merged into{' '}
          <Link href={`/dashboard/ideas/${merged.id}`} className="font-semibold underline">
            {merged.title}
          </Link>{' '}
          (▲ {merged.voteCount}). Taking you there…
        </div>
      ) : null}

      <div className="card pad">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={async () => {
              if (!user) return
              setActionError('')
              try {
                await toggleVote(suggestion, user.id)
              } catch (err) {
                setActionError(feedbackWriteError(err))
              }
            }}
            aria-pressed={voted}
            aria-label={`Vote for ${suggestion.title}, ${suggestion.voteCount} votes`}
            className={`flex min-h-[88px] min-w-[78px] flex-col items-center justify-center rounded-2xl px-2 py-3 text-xl font-extrabold ${
              voted ? 'bg-[var(--blue)] text-white' : 'bg-[var(--soft)] text-[var(--ink2)]'
            }`}
          >
            <ChevronUpIcon className="h-5 w-5" />
            {suggestion.voteCount}
            <span className="text-[10px] font-semibold uppercase">{voted ? 'Voted' : 'Vote'}</span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">{suggestion.title}</h1>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => user && void toggleFollow(suggestion.id, user.id)}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
                <button type="button" className="btn sm ghost" onClick={() => void copyLink()}>
                  Share
                </button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink2)]">{suggestion.details}</p>
            <p className="mt-3 text-xs text-[var(--ink3)]">
              {authorLine(suggestion, user?.id, organization?.id)} · {suggestion.category} ·{' '}
              {CUSTOMER_STATUS_LABEL[current]}
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--soft)] p-3">
              <p className="text-sm font-semibold">{wanted}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="card pad" data-hue="task">
        <p className="eyebrow">{CUSTOMER_STATUS_LABEL[current]}</p>
        <p className="mt-1 font-semibold">{CUSTOMER_STATUS_COPY[current]}</p>
        {statusHistory.length > 0 ? (
          <ol className="mt-3 space-y-1 text-xs text-[var(--ink3)]">
            <li>Submitted {suggestion.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</li>
            {statusHistory.map((entry) => (
              <li key={entry.id}>
                {entry.toValue.replace(/_/g, ' ')} · {entry.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </li>
            ))}
          </ol>
        ) : null}
        {suggestion.officialResponse ? (
          <div className="official mt-3 rounded-[18px] border border-[color-mix(in_srgb,var(--blue)_40%,var(--line))] bg-[color-mix(in_srgb,var(--blue)_10%,white)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--blue)]">Product team</p>
            <p className="mt-2 text-sm">{suggestion.officialResponse}</p>
          </div>
        ) : null}
      </section>

      <section className="card pad">
        <div className="flex items-center justify-between gap-2">
          <h2 className="h2 inline-flex items-center gap-2">
            <ChatBubbleLeftIcon className="h-5 w-5 text-[var(--task)]" />
            Discussion
          </h2>
          <button type="button" className="text-xs font-semibold text-[var(--blue)]" onClick={() => setSortNewest((value) => !value)}>
            {sortNewest ? 'Oldest first' : 'Newest first'}
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {ideaComments.length === 0 ? (
            <p className="text-sm text-[var(--ink3)]">No comments yet. Add context that would help other people vote.</p>
          ) : null}
          {ideaComments.map((comment) => {
            const mine = comment.authorUserId === user?.id
            const canEdit = mine && Date.now() - comment.createdAt.getTime() <= 15 * 60_000
            return (
              <div key={comment.id} className="rounded-xl bg-[var(--soft)] p-3">
                <p className="text-xs font-semibold text-[var(--ink3)]">
                  {comment.isOfficial ? 'Product team' : mine ? 'You' : 'A Project Planner user'}
                  {comment.editedAt ? ' · edited' : ''}
                </p>
                {editingId === comment.id ? (
                  <>
                    <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="pp-in mt-2 min-h-[70px]" />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn sm primary"
                        onClick={() => {
                          if (!user) return
                          void editComment(comment, user.id, editBody).then(() => setEditingId(null))
                        }}
                      >
                        Save
                      </button>
                      <button type="button" className="btn sm ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm">{comment.body}</p>
                )}
                {mine && editingId !== comment.id ? (
                  <div className="mt-2 flex gap-2 text-xs font-semibold">
                    {canEdit ? (
                      <button
                        type="button"
                        className="text-[var(--blue)]"
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditBody(comment.body)
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-[var(--red)]"
                      onClick={() => user && void deleteComment(comment, user.id)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="pp-in mt-3 min-h-[90px]"
          placeholder="Add a comment…"
        />
        <button
          type="button"
          className="btn primary mt-2"
          disabled={!body.trim() || saving || !user}
          onClick={async () => {
            if (!user) return
            setSaving(true)
            setActionError('')
            try {
              await addComment(suggestion, user.id, `${user.firstName} ${user.surname}`.trim() || user.email, body)
              setBody('')
            } catch (err) {
              setActionError(feedbackWriteError(err))
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Posting…' : 'Post comment'}
        </button>
      </section>

      {related.length > 0 ? (
        <section className="card pad">
          <h2 className="h2">Related ideas</h2>
          <div className="mt-2 space-y-2">
            {related.map((row) => (
              <Link key={row.id} href={`/dashboard/ideas/${row.id}`} className="block text-sm font-semibold text-[var(--blue)]">
                {row.title} · {row.voteCount} votes
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
