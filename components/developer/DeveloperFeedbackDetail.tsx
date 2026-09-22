'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { relatedFeatureUsage } from '@/lib/analytics/aggregations'
import { resolveDateRange } from '@/lib/analytics/dateRange'
import {
  CONSOLE_STATUS_LABEL,
  CUSTOMER_STATUS_COPY,
  CUSTOMER_STATUS_LABEL,
  DECISION_HUE,
  DECISION_LABEL,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  PRODUCT_DECISIONS,
  RELATED_FEATURES,
  unifiedStatus,
  type FeedbackPublicStatus,
  type FeedbackStatus,
  type ProductDecision,
} from '@/lib/feedback/types'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { feedbackWriteError } from '@/lib/feedback/errors'
import { mergePreviewCounts } from '@/lib/feedback/similar'

const STATUSES: FeedbackPublicStatus[] = ['under_review', 'planned', 'in_progress', 'released', 'not_planned']

export function DeveloperFeedbackDetailScreen({ ideaId }: { ideaId: string }) {
  const { user } = useAuthStore()
  const { suggestions, votes, comments, history, internalNotes, loading, error, loadBoard, loadSuggestionExtras, updateAdmin, saveInternalNotes, mergeSuggestions } =
    useFeedbackStore()
  const { events, load } = useAnalyticsStore()
  const [notes, setNotes] = useState('')
  const [response, setResponse] = useState('')
  const [mergeId, setMergeId] = useState('')
  const [reason, setReason] = useState('')
  const [adminBusy, setAdminBusy] = useState<'response' | 'notes' | 'other' | null>(null)
  const [adminError, setAdminError] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const range = useMemo(() => resolveDateRange('last_30'), [])

  useEffect(() => {
    void loadBoard(true).then(() => loadSuggestionExtras(ideaId, true))
    void load(range.start)
  }, [ideaId, loadBoard, loadSuggestionExtras, load, range.start])

  const suggestion = suggestions.find((row) => row.id === ideaId)
  useEffect(() => {
    if (suggestion) {
      setResponse(suggestion.officialResponse || '')
      setNotes(internalNotes[suggestion.id]?.notes || '')
    }
  }, [suggestion, internalNotes])

  if (loading && !suggestion) return <LoadingSpinner />
  if (!suggestion) return <EmptyState title="Request not found" description="It may have been deleted." />

  const recentVotes = votes.filter(
    (vote) => vote.suggestionId === suggestion.id && Date.now() - vote.createdAt.getTime() <= 14 * 86_400_000
  ).length
  const usage = relatedFeatureUsage(events, suggestion.relatedFeature, range)
  const voters = votes.filter((vote) => vote.suggestionId === suggestion.id)
  const related = suggestions.filter(
    (row) => row.id !== suggestion.id && !row.mergedIntoId && row.relatedFeature === suggestion.relatedFeature
  )

  const actor = user ? { id: user.id, name: `${user.firstName} ${user.surname}`.trim() || user.email } : null

  const runAdmin = async (
    kind: 'response' | 'notes' | 'other',
    work: (current: { id: string; name: string }) => Promise<void>
  ) => {
    if (!actor) {
      setAdminError('Sign in again to save this change.')
      return
    }
    setAdminBusy(kind)
    setAdminError('')
    setAdminMessage('')
    try {
      await work(actor)
      if (kind === 'response') setAdminMessage('Response published.')
      if (kind === 'notes') setAdminMessage('Internal notes saved.')
    } catch (err) {
      setAdminError(feedbackWriteError(err))
    } finally {
      setAdminBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/developer/feedback" className="btn sm ghost">
        Feedback
      </Link>
      {error ? <ErrorBanner message={error} /> : null}
      {adminError ? <ErrorBanner message={adminError} /> : null}
      {adminMessage ? (
        <div className="banner" data-hue="hs">
          {adminMessage}
        </div>
      ) : null}
      <h1 className="text-xl font-extrabold">{suggestion.title}</h1>
      <p className="text-sm text-[var(--ink3)]">
        {suggestion.organizationName?.trim() || 'Unknown organisation'} · {suggestion.authorName} · {suggestion.category}
      </p>
      <p className="whitespace-pre-wrap text-sm text-[var(--ink2)]">{suggestion.details}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card pad">
          <p className="eyebrow">Customer demand</p>
          <p className="text-2xl font-extrabold">{suggestion.voteCount} votes</p>
          <p className="text-xs text-[var(--ink3)]">{suggestion.commentCount} comments · {voters.length} voters</p>
        </div>
        <div className="card pad">
          <p className="eyebrow">Recent momentum</p>
          <p className="text-2xl font-extrabold">+{recentVotes}</p>
          <p className="text-xs text-[var(--ink3)]">votes in the last 14 days</p>
        </div>
        <div className="card pad">
          <p className="eyebrow">Usage context</p>
          <p className="text-2xl font-extrabold">{usage.users}</p>
          <p className="text-xs text-[var(--ink3)]">
            users used {suggestion.relatedFeature.replace('_', ' ')} this month · {usage.uses} events
          </p>
        </div>
        <div className="card pad" data-hue={DECISION_HUE[suggestion.productDecision]}>
          <p className="eyebrow">Product decision</p>
          <p className="text-xl font-extrabold">{CONSOLE_STATUS_LABEL[unifiedStatus(suggestion)]}</p>
          <p className="text-xs">{CUSTOMER_STATUS_LABEL[unifiedStatus(suggestion)]}</p>
        </div>
      </div>

      <section className="card pad">
        <h2 className="h2">Traffic-light decision</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">These numbers inform the decision. They do not choose it for you.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRODUCT_DECISIONS.map((decision) => (
            <button
              key={decision}
              type="button"
              className="pill"
              data-hue={DECISION_HUE[decision]}
              onClick={() =>
                void runAdmin('other', (current) =>
                  updateAdmin({
                    suggestion,
                    actorUserId: current.id,
                    actorName: current.name,
                    patch: { productDecision: decision },
                    reason,
                  })
                )
              }
            >
              {DECISION_LABEL[decision]}
            </button>
          ))}
        </div>
        <label className="eyebrow mt-4 block">Shared status (customers and console)</label>
        <select
          className="pp-in mt-1"
          value={unifiedStatus(suggestion)}
          onChange={(e) =>
            void runAdmin('other', (current) =>
              updateAdmin({
                suggestion,
                actorUserId: current.id,
                actorName: current.name,
                patch: { status: e.target.value as FeedbackStatus },
                reason,
              })
            )
          }
        >
          {FEEDBACK_STATUSES.filter((status) => status !== 'merged').map((status) => (
            <option key={status} value={status}>
              {CONSOLE_STATUS_LABEL[status]} · customer: {CUSTOMER_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <label className="eyebrow mt-4 block">Public status customers see</label>
        <select
          className="pp-in mt-1"
          value={suggestion.publicStatus}
          onChange={(e) =>
            void runAdmin('other', (current) =>
              updateAdmin({
                suggestion,
                actorUserId: current.id,
                actorName: current.name,
                patch: { publicStatus: e.target.value as FeedbackPublicStatus },
                reason,
              })
            )
          }
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {CUSTOMER_STATUS_LABEL[status === 'released' ? 'shipped' : status === 'under_review' ? 'under_review' : status]}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-[var(--ink2)]">{CUSTOMER_STATUS_COPY[unifiedStatus(suggestion)]}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="eyebrow">Category</span>
            <select
              className="pp-in mt-1"
              value={suggestion.category}
              onChange={(e) =>
                void runAdmin('other', (current) =>
                  updateAdmin({
                    suggestion,
                    actorUserId: current.id,
                    actorName: current.name,
                    patch: { category: e.target.value as (typeof FEEDBACK_CATEGORIES)[number] },
                  })
                )
              }
            >
              {FEEDBACK_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="eyebrow">Related feature</span>
            <select
              className="pp-in mt-1"
              value={suggestion.relatedFeature}
              onChange={(e) =>
                void runAdmin('other', (current) =>
                  updateAdmin({
                    suggestion,
                    actorUserId: current.id,
                    actorName: current.name,
                    patch: { relatedFeature: e.target.value as (typeof RELATED_FEATURES)[number] },
                  })
                )
              }
            >
              {RELATED_FEATURES.map((item) => (
                <option key={item} value={item}>
                  {item.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn sm ghost"
            onClick={() =>
              void runAdmin('other', (current) =>
                updateAdmin({
                  suggestion,
                  actorUserId: current.id,
                  actorName: current.name,
                  patch: { pinned: !suggestion.pinned },
                })
              )
            }
          >
            {suggestion.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() =>
              void runAdmin('other', (current) =>
                updateAdmin({
                  suggestion,
                  actorUserId: current.id,
                  actorName: current.name,
                  patch: { hidden: !suggestion.hidden },
                })
              )
            }
          >
            {suggestion.hidden ? 'Unhide' : 'Hide'}
          </button>
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="pp-in mt-3"
          placeholder="Optional reason for the audit trail"
        />
      </section>

      <section className="card pad">
        <h2 className="h2">Customer response</h2>
        <textarea value={response} onChange={(e) => setResponse(e.target.value)} className="pp-in mt-2 min-h-[90px]" />
        <button
          type="button"
          className="btn primary mt-2"
          disabled={adminBusy !== null || !response.trim()}
          onClick={() =>
            void runAdmin('response', (current) =>
              updateAdmin({
                suggestion,
                actorUserId: current.id,
                actorName: current.name,
                patch: { officialResponse: response.trim() },
                reason,
              })
            )
          }
        >
          {adminBusy === 'response' ? 'Publishing…' : 'Publish response'}
        </button>
      </section>

      <section className="card pad" data-hue="warn">
        <h2 className="h2">Internal notes</h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">Never shown to customers.</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="pp-in mt-2 min-h-[90px]" />
        <button
          type="button"
          className="btn sm hue mt-2"
          data-hue="warn"
          disabled={adminBusy !== null}
          onClick={() => void runAdmin('notes', (current) => saveInternalNotes(suggestion.id, notes, current.id))}
        >
          {adminBusy === 'notes' ? 'Saving…' : 'Save internal notes'}
        </button>
      </section>

      <section className="card pad">
        <h2 className="h2">Merge duplicate</h2>
        <select className="pp-in mt-2" value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
          <option value="">Select destination feedback</option>
          {suggestions
            .filter((row) => row.id !== suggestion.id && !row.mergedIntoId && !row.hidden)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
        </select>
        {mergeId ? (
          <MergePreview source={suggestion} destinationId={mergeId} votes={votes} suggestions={suggestions} />
        ) : null}
        <button
          type="button"
          className="btn sm ghost mt-2"
          disabled={!mergeId || !actor}
          onClick={() => {
            const destination = suggestions.find((row) => row.id === mergeId)
            if (!destination || !actor) return
            void runAdmin('other', (current) =>
              mergeSuggestions({
                source: suggestion,
                destination,
                actorUserId: current.id,
                actorName: current.name,
                reason,
              })
            )
          }}
        >
          Merge into selected
        </button>
      </section>

      <section className="card pad">
        <h2 className="h2">Comments</h2>
        {comments.filter((comment) => comment.suggestionId === suggestion.id).length === 0 ? <p className="mt-2 text-sm text-[var(--ink3)]">No comments.</p> : null}
        <div className="mt-2 space-y-2">
          {comments
            .filter((comment) => comment.suggestionId === suggestion.id)
            .map((comment) => (
            <div key={comment.id} className="rounded-xl bg-[var(--soft)] p-3 text-sm">
              <p className="text-xs font-semibold">{comment.authorName}</p>
              {comment.body}
            </div>
          ))}
        </div>
      </section>

      <section className="card pad">
        <h2 className="h2">Related requests</h2>
        {related.length === 0 ? <p className="mt-2 text-sm text-[var(--ink3)]">None in this feature area.</p> : null}
        <div className="mt-2 space-y-2">
          {related.slice(0, 6).map((row) => (
            <Link key={row.id} href={`/developer/feedback/${row.id}`} className="block text-sm font-semibold">
              {row.title} · {row.voteCount} votes
            </Link>
          ))}
        </div>
      </section>

      <section className="card pad">
        <h2 className="h2">Audit trail</h2>
        {history.filter((entry) => entry.suggestionId === suggestion.id).length === 0 ? <p className="mt-2 text-sm text-[var(--ink3)]">No admin changes yet.</p> : null}
        <ul className="mt-2 space-y-2 text-sm">
          {history
            .filter((entry) => entry.suggestionId === suggestion.id)
            .map((entry) => (
            <li key={entry.id}>
              <span className="font-semibold">{entry.actorName}</span> changed {entry.field} from {entry.fromValue} to {entry.toValue}
              {entry.reason ? ` — ${entry.reason}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function MergePreview({
  source,
  destinationId,
  votes,
  suggestions,
}: {
  source: { id: string; title: string }
  destinationId: string
  votes: { suggestionId: string; userId: string }[]
  suggestions: { id: string; title: string }[]
}) {
  const destination = suggestions.find((row) => row.id === destinationId)
  if (!destination) return null
  const preview = mergePreviewCounts(
    votes.filter((vote) => vote.suggestionId === destination.id),
    votes.filter((vote) => vote.suggestionId === source.id)
  )
  return (
    <p className="mt-2 rounded-xl bg-[var(--soft)] p-3 text-sm text-[var(--ink2)]">
      {source.title} has {preview.source} voters, {destination.title} has {preview.destination},{' '}
      <strong>{preview.overlap} overlap</strong> → merged total <strong>{preview.mergedTotal}</strong>.
    </p>
  )
}
