'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  useDashboardStore,
  DEFAULT_LAYOUT,
  type TileId,
} from '@/lib/stores/dashboardStore'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import { DEFAULT_HERO_METRICS, isHeroEligible, MAX_HERO_METRICS } from '@/lib/dashboard/heroMetrics'
import { TILE_CATALOGUE, TILE_CATEGORIES } from '@/lib/dashboard/tileCatalogue'
import { setDashboardTileDrag, type HeroTileDrop } from '@/lib/dashboard/dashboardDrag'
import { DashboardEditorPreview } from '@/components/dashboard/DashboardTilePreviews'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { AppTopNotice } from '@/components/ui/AppTopNotice'

export default function DashboardEditPage() {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()
  const {
    layout: savedLayout,
    heroMetrics: savedHeroMetrics,
    loading: layoutLoading,
    loadLayout,
    saveLayout,
  } = useDashboardStore()

  const [draftLayout, setDraftLayout] = useState<TileId[] | null>(null)
  const [draftHeroMetrics, setDraftHeroMetrics] = useState<TileId[] | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dragSrc, setDragSrc] = useState<TileId | null>(null)
  const [heroDragSrc, setHeroDragSrc] = useState<TileId | null>(null)
  const [draggingTileId, setDraggingTileId] = useState<TileId | null>(null)
  const [topNotice, setTopNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (organization?.id && user?.id) {
      loadLayout(user.id, organization.id)
    }
  }, [organization?.id, user?.id, loadLayout])

  useEffect(() => {
    if (draftLayout === null && !layoutLoading) {
      setDraftLayout([...savedLayout])
      setDraftHeroMetrics([...savedHeroMetrics])
    }
  }, [draftLayout, layoutLoading, savedLayout, savedHeroMetrics])

  const filtered = TILE_CATALOGUE.filter((m) => {
    const catOk = activeCategory === 'All' || m.category === activeCategory
    const q = search.trim().toLowerCase()
    const qOk =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
    return catOk && qOk
  })

  function toggleTile(id: TileId) {
    setDraftLayout((prev) => {
      if (!prev) return prev
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    })
  }

  function toggleDashboardPlacement(id: TileId) {
    const inGrid = draftLayout?.includes(id)
    const inHero = draftHeroMetrics?.includes(id)

    if (inGrid) {
      setDraftLayout((prev) => (prev ? prev.filter((x) => x !== id) : prev))
      return
    }

    if (inHero) {
      removeHeroMetric(id)
      return
    }

    toggleTile(id)
  }

  function removeTile(id: TileId) {
    setDraftLayout((prev) => (prev ? prev.filter((x) => x !== id) : prev))
  }

  function handleDrop(targetId: TileId) {
    if (!dragSrc || dragSrc === targetId) return
    setDraftLayout((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const si = next.indexOf(dragSrc)
      const di = next.indexOf(targetId)
      if (si < 0 || di < 0) return prev
      next.splice(si, 1)
      next.splice(di, 0, dragSrc)
      return next
    })
    clearDragState()
  }

  function showTopNotice(message: string) {
    setTopNotice(message)
  }

  function clearDragState() {
    setDragSrc(null)
    setHeroDragSrc(null)
    setDraggingTileId(null)
  }

  function handleGridDragStart(id: TileId) {
    setDragSrc(id)
    setDraggingTileId(id)
  }

  function handleHeroDragStart(id: TileId) {
    setHeroDragSrc(id)
    setDraggingTileId(id)
  }

  function dropHeroTile({ id, source }: HeroTileDrop) {
    clearDragState()

    if (!isHeroEligible(id)) {
      showTopNotice(
        'This tile cannot go in the blue section — only single-metric tiles are allowed (no charts or wide tiles).'
      )
      return
    }

    if (draftHeroMetrics?.includes(id)) {
      if (source === 'grid') {
        setDraftLayout((prev) => (prev ? prev.filter((x) => x !== id) : prev))
      }
      return
    }

    if ((draftHeroMetrics?.length ?? 0) >= MAX_HERO_METRICS) {
      showTopNotice(`Maximum ${MAX_HERO_METRICS} hero metrics allowed. Remove one first.`)
      return
    }

    setDraftHeroMetrics((prev) => (prev ? [...prev, id] : prev))

    if (source === 'grid') {
      setDraftLayout((prev) => (prev ? prev.filter((x) => x !== id) : prev))
    }
  }

  function addHeroMetric(id: TileId) {
    dropHeroTile({ id, source: 'catalogue' })
  }

  function removeHeroMetric(id: TileId) {
    setDraftHeroMetrics((prev) => (prev ? prev.filter((x) => x !== id) : prev))
  }

  function handleHeroDrop(targetId: TileId) {
    if (!heroDragSrc || heroDragSrc === targetId) return
    setDraftHeroMetrics((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const si = next.indexOf(heroDragSrc)
      const di = next.indexOf(targetId)
      if (si < 0 || di < 0) return prev
      next.splice(si, 1)
      next.splice(di, 0, heroDragSrc)
      return next
    })
    setHeroDragSrc(null)
    setDraggingTileId(null)
  }

  async function handleSave() {
    if (!user?.id || !organization?.id || !draftLayout || !draftHeroMetrics) return
    setSaving(true)
    try {
      await saveLayout(user.id, organization.id, {
        layout: draftLayout,
        heroMetrics: draftHeroMetrics,
      }, {
        updateOrgDefault: hasAdminAccess(user),
        updatePlatformDefault: user.isSuperAdmin === true,
      })
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        router.push('/dashboard')
      }, 800)
    } catch {
      showTopNotice('Could not save your dashboard layout. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setDraftLayout([...DEFAULT_LAYOUT])
    setDraftHeroMetrics([...DEFAULT_HERO_METRICS])
  }

  if (loading || !user) return null

  if (draftLayout === null || draftHeroMetrics === null) {
    return <LoadingSpinner label="Loading editor…" />
  }

  return (
    <div className="space-y-8">
      <AppTopNotice message={topNotice} onDismiss={() => setTopNotice(null)} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard editor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Customise the blue hero metrics (up to {MAX_HERO_METRICS} single-number tiles) and the widget grid below.
            Drag eligible tiles from the preview grid into the blue section — charts and wide tiles cannot be placed there.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Reset to default
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition ${
              saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-70`}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      </div>

      <DashboardEditorPreview
        layout={draftLayout}
        heroMetrics={draftHeroMetrics}
        userName={user.firstName || user.email}
        organizationName={organization?.name || 'your organisation'}
        onRemove={removeTile}
        onDragStart={handleGridDragStart}
        onDrop={handleDrop}
        dragSrc={dragSrc}
        onRemoveHeroMetric={removeHeroMetric}
        onHeroDragStart={handleHeroDragStart}
        onHeroDrop={handleHeroDrop}
        heroDragSrc={heroDragSrc}
        onDropHeroTile={dropHeroTile}
        draggingTileId={draggingTileId}
        onDragEnd={clearDragState}
      />

      <section>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Add tiles</h2>
        <p className="mb-4 text-sm text-slate-500">
          Tap to add or remove grid tiles. Drag hero-eligible tiles from the preview grid or catalogue into the blue
          section, or use the star pin. Wide tiles and charts cannot be placed in the hero.
        </p>

        <input
          type="text"
          placeholder="Search tiles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search tiles"
        />

        <div className="mb-4 flex flex-wrap gap-1.5">
          {TILE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((meta) => {
            const inGrid = draftLayout.includes(meta.id)
            const inHero = draftHeroMetrics.includes(meta.id)
            const isOnDashboard = inGrid || inHero
            const heroFull = draftHeroMetrics.length >= MAX_HERO_METRICS

            return (
              <div
                key={meta.id}
                draggable={meta.heroEligible}
                onDragStart={(e) => {
                  if (!meta.heroEligible) return
                  setDashboardTileDrag(e, meta.id, 'catalogue')
                  e.dataTransfer.effectAllowed = 'copy'
                  setDraggingTileId(meta.id)
                }}
                onDragEnd={clearDragState}
                className={`relative rounded-2xl border p-4 text-left transition sm:col-span-1 ${
                  meta.wide ? 'lg:col-span-2' : ''
                } ${
                  isOnDashboard
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                } ${meta.heroEligible ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <div className="absolute right-3 top-3 flex items-center gap-1.5">
                  {meta.heroEligible && (
                    <button
                      type="button"
                      onClick={() => (inHero ? removeHeroMetric(meta.id) : addHeroMetric(meta.id))}
                      disabled={!inHero && heroFull}
                      title={
                        inHero
                          ? 'Remove from hero'
                          : heroFull
                            ? `Hero full (${MAX_HERO_METRICS} max)`
                            : 'Add to hero'
                      }
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        inHero
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'
                      }`}
                      aria-label={inHero ? 'Remove from hero' : 'Add to hero'}
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleDashboardPlacement(meta.id)}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                      isOnDashboard
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                    }`}
                    aria-label={isOnDashboard ? 'Remove from dashboard' : 'Add to dashboard'}
                  >
                    {isOnDashboard ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="flex items-start gap-3 pr-16">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: meta.iconBg }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke={meta.iconColor} strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{meta.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {meta.category} · {meta.wide ? 'Wide (2 columns)' : 'Standard (1 column)'}
                      </span>
                      {meta.heroEligible && (
                        <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Hero eligible
                        </span>
                      )}
                      {inHero && (
                        <span className="inline-block rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          In hero
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
