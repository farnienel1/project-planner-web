'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChatBubbleLeftIcon, ChevronUpIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { feedbackWriteError, hasVoted, useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { PUBLIC_STATUS_COPY, PUBLIC_STATUS_LABEL } from '@/lib/feedback/types'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'

export function FeedbackDetailScreen({ ideaId }: { ideaId: string }) {
  const { user } = useAuthStore()
  const { suggestions, votes, comments, loading, error, loadBoard, loadSuggestionExtras, toggleVote, addComment } =
    useFeedbackStore()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    void loadBoard(false).then(() => loadSuggestionExtras(ideaId, false))
  }, [ideaId, loadBoard, loadSuggestionExtras])

  const suggestion = suggestions.find((row) => row.id === ideaId)
  const merged = suggestion?.mergedIntoId
    ? suggestions.find((row) => row.id === suggestion.mergedIntoId)
    : undefined

  if (loading && !suggestion) return <LoadingSpinner />
  if (!suggestion) return <EmptyState title="Feedback not found" description="It may have been hidden or merged." />

  const voted = hasVoted(votes, suggestion.id, user?.id)
  const orgName = suggestion.organizationName?.trim() || 'An organisation'

  return (
    <div className="stack space-y-4" data-hue="task">
      <Link href="/dashboard/ideas" className="btn sm ghost w-fit">
        ← Feedback
      </Link>
      {error ? <ErrorBanner message={error} /> : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}
      <div className="card pad">
        <div className="flex items-start gap-3">
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
            className={`flex min-w-[64px] flex-col items-center rounded-xl px-2 py-3 text-lg font-extrabold ${
              voted ? 'bg-[var(--task-t)] text-[var(--task)]' : 'bg-[var(--soft)] text-[var(--ink2)]'
            }`}
            aria-label={voted ? 'Remove vote' : 'Vote for this feedback'}
          >
            <ChevronUpIcon className="h-5 w-5" />
            {suggestion.voteCount}
            <span className="text-[10px] font-semibold uppercase">{voted ? 'Voted' : 'Vote'}</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-[var(--ink)]">{suggestion.title}</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink2)]">{suggestion.details}</p>
            <p className="mt-3 text-xs text-[var(--ink3)]">
              {orgName} · {suggestion.authorName} · {suggestion.category} ·{' '}
              {suggestion.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <section className="card pad" data-hue="task">
        <p className="eyebrow">{PUBLIC_STATUS_LABEL[suggestion.publicStatus]}</p>
        <p className="mt-1 font-semibold">{PUBLIC_STATUS_COPY[suggestion.publicStatus]}</p>
        {suggestion.officialResponse ? (
          <p className="mt-3 rounded-xl bg-[var(--soft)] p-3 text-sm">{suggestion.officialResponse}</p>
        ) : null}
        {merged ? (
          <p className="mt-3 text-sm">
            Merged into{' '}
            <Link href={`/dashboard/ideas/${merged.id}`} className="font-semibold text-[var(--blue)]">
              {merged.title}
            </Link>
          </p>
        ) : null}
      </section>

      <section className="card pad">
        <h2 className="h2 inline-flex items-center gap-2">
          <ChatBubbleLeftIcon className="h-5 w-5 text-[var(--task)]" />
          Discussion
        </h2>
        <div className="mt-3 space-y-3">
          {comments.filter((comment) => comment.suggestionId === suggestion.id).length === 0 ? <p className="text-sm text-[var(--ink3)]">No comments yet. Add context that would help other organisations vote.</p> : null}
          {comments
            .filter((comment) => comment.suggestionId === suggestion.id)
            .map((comment) => (
            <div key={comment.id} className="rounded-xl bg-[var(--soft)] p-3">
              <p className="text-xs font-semibold text-[var(--ink3)]">{comment.authorName}</p>
              <p className="mt-1 text-sm">{comment.body}</p>
            </div>
          ))}
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
    </div>
  )
}
