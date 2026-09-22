'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { relatedFeatureUsage } from '@/lib/analytics/aggregations'
import { resolveDateRange } from '@/lib/analytics/dateRange'
import {
  DECISION_HUE,
  DECISION_LABEL,
  FEEDBACK_CATEGORIES,
  PRODUCT_DECISIONS,
  PUBLIC_STATUS_COPY,
  PUBLIC_STATUS_LABEL,
  RELATED_FEATURES,
  type FeedbackPublicStatus,
  type ProductDecision,
} from '@/lib/feedback/types'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'

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

  return (
    <div className="space-y-4">
      <Link href="/developer/feedback" className="btn sm ghost">
        Ideas
      </Link>
      {error ? <ErrorBanner message={error} /> : null}
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
          <p className="text-xl font-extrabold">{DECISION_LABEL[suggestion.productDecision]}</p>
          <p className="text-xs">{PUBLIC_STATUS_LABEL[suggestion.publicStatus]}</p>
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
                actor &&
                void updateAdmin({
                  suggestion,
                  actorUserId: actor.id,
                  actorName: actor.name,
                  patch: { productDecision: decision },
                  reason,
                })
              }
            >
              {DECISION_LABEL[decision]}
            </button>
          ))}
        </div>
        <label className="eyebrow mt-4 block">Public status customers see</label>
        <select
          className="pp-in mt-1"
          value={suggestion.publicStatus}
          onChange={(e) =>
            actor &&
            void updateAdmin({
              suggestion,
              actorUserId: actor.id,
              actorName: actor.name,
              patch: { publicStatus: e.target.value as FeedbackPublicStatus },
              reason,
            })
          }
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {PUBLIC_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-[var(--ink2)]">{PUBLIC_STATUS_COPY[suggestion.publicStatus]}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="eyebrow">Category</span>
            <select
              className="pp-in mt-1"
              value={suggestion.category}
              onChange={(e) =>
                actor &&
                void updateAdmin({
                  suggestion,
                  actorUserId: actor.id,
                  actorName: actor.name,
                  patch: { category: e.target.value as (typeof FEEDBACK_CATEGORIES)[number] },
                })
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
                actor &&
                void updateAdmin({
                  suggestion,
                  actorUserId: actor.id,
                  actorName: actor.name,
                  patch: { relatedFeature: e.target.value as (typeof RELATED_FEATURES)[number] },
                })
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
              actor &&
              void updateAdmin({
                suggestion,
                actorUserId: actor.id,
                actorName: actor.name,
                patch: { pinned: !suggestion.pinned },
              })
            }
          >
            {suggestion.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() =>
              actor &&
              void updateAdmin({
                suggestion,
                actorUserId: actor.id,
                actorName: actor.name,
                patch: { hidden: !suggestion.hidden },
              })
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
          onClick={() =>
            actor &&
            void updateAdmin({
              suggestion,
              actorUserId: actor.id,
              actorName: actor.name,
              patch: { officialResponse: response },
              reason,
            })
          }
        >
          Publish response
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
          onClick={() => actor && void saveInternalNotes(suggestion.id, notes, actor.id)}
        >
          Save internal notes
        </button>
      </section>

      <section className="card pad">
        <h2 className="h2">Merge duplicate</h2>
        <select className="pp-in mt-2" value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
          <option value="">Select destination idea</option>
          {suggestions
            .filter((row) => row.id !== suggestion.id && !row.mergedIntoId && !row.hidden)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
        </select>
        <button
          type="button"
          className="btn sm ghost mt-2"
          disabled={!mergeId || !actor}
          onClick={() => {
            const destination = suggestions.find((row) => row.id === mergeId)
            if (!destination || !actor) return
            void mergeSuggestions({
              source: suggestion,
              destination,
              actorUserId: actor.id,
              actorName: actor.name,
              reason,
            })
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
