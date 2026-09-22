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
  PRODUCT_DECISIONS,
  PUBLIC_STATUS_LABEL,
  type ProductDecision,
} from '@/lib/feedback/types'
import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'

type Filter = 'all' | 'trending' | 'voted' | 'review' | 'planned' | 'in_progress' | 'released' | 'declined'

export function DeveloperFeedbackScreen() {
  const search = useSearchParams()
  const initial = (search.get('filter') as Filter) || 'all'
  const [filter, setFilter] = useState<Filter>(initial)
  const { suggestions, votes, loading, error, loadBoard } = useFeedbackStore()

  useEffect(() => {
    void loadBoard(true)
  }, [loadBoard])

  const rows = useMemo(() => {
    const open = suggestions.filter((row) => !row.mergedIntoId)
    switch (filter) {
      case 'trending':
        return [...open].sort((a, b) => trendingScore(b, votes) - trendingScore(a, votes))
      case 'voted':
        return [...open].sort((a, b) => b.voteCount - a.voteCount)
      case 'review':
        return open.filter((row) => row.productDecision === 'none' && !row.hidden)
      case 'planned':
        return open.filter((row) => row.productDecision === 'build' || row.publicStatus === 'planned')
      case 'in_progress':
        return open.filter((row) => row.productDecision === 'in_progress' || row.publicStatus === 'in_progress')
      case 'released':
        return open.filter((row) => row.productDecision === 'released' || row.publicStatus === 'released')
      case 'declined':
        return open.filter((row) => row.productDecision === 'decline' || row.publicStatus === 'not_planned')
      default:
        return open
    }
  }, [suggestions, votes, filter])

  if (loading && suggestions.length === 0) return <LoadingSpinner />

  return (
    <DeveloperShell title="Feedback">
      {error ? <ErrorBanner message={error} /> : null}
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
      {rows.length === 0 ? (
        <EmptyState title="Nothing in this list" description="Customer ideas appear here after someone submits on the Ideas board." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link key={row.id} href={`/developer/feedback/${row.id}`} className="card pad block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{row.title}</p>
                  <p className="mt-1 text-xs text-[var(--ink3)]">
                    {row.voteCount} votes · {row.commentCount} comments · {row.category}
                    {row.organizationName ? ` · ${row.organizationName}` : ''}
                  </p>
                </div>
                <span className="pill" data-hue={DECISION_HUE[row.productDecision]}>
                  {DECISION_LABEL[row.productDecision]}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--ink3)]">{PUBLIC_STATUS_LABEL[row.publicStatus]}</p>
            </Link>
          ))}
        </div>
      )}
    </DeveloperShell>
  )
}

export function DeveloperRoadmapScreen() {
  const { suggestions, loading, loadBoard, updateAdmin } = useFeedbackStore()
  const { user } = useAuthStore()

  useEffect(() => {
    void loadBoard(true)
  }, [loadBoard])

  const columns: { id: ProductDecision; label: string }[] = [
    { id: 'investigate', label: 'Investigate' },
    { id: 'build', label: 'Build' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'released', label: 'Released' },
  ]

  if (loading && suggestions.length === 0) return <LoadingSpinner />

  return (
    <DeveloperShell title="Roadmap">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const cards = suggestions.filter((row) => !row.hidden && !row.mergedIntoId && row.productDecision === column.id)
          return (
            <section key={column.id} className="card pad">
              <h2 className="h2">{column.label}</h2>
              <div className="mt-3 space-y-2">
                {cards.length === 0 ? <p className="text-xs text-[var(--ink3)]">No cards</p> : null}
                {cards.map((row) => (
                  <div key={row.id} className="rounded-xl bg-[var(--soft)] p-3">
                    <Link href={`/developer/feedback/${row.id}`} className="text-sm font-bold">
                      {row.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--ink3)]">{row.voteCount} votes</p>
                    <select
                      className="pp-in mt-2 text-xs"
                      value={row.productDecision}
                      onChange={(e) => {
                        if (!user) return
                        void updateAdmin({
                          suggestion: row,
                          actorUserId: user.id,
                          actorName: `${user.firstName} ${user.surname}`.trim(),
                          patch: { productDecision: e.target.value as ProductDecision },
                        })
                      }}
                    >
                      {PRODUCT_DECISIONS.filter((item) => item !== 'none' && item !== 'decline').map((item) => (
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
    </DeveloperShell>
  )
}
