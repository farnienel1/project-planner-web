/**
 * Home stat strip: the tiles the old hero showed for this viewer (their metrics, values and links), plus the old
 * Warnings card when the viewer sees warnings and it is not already one of their metrics. Presentational.
 * A warnings tile with a count above 0 stands out (solid red triangle, red figure); at 0 it is neutral.
 */

import {
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SunIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

export type HomeStatTile = {
  id: string
  label: string
  value: string | number
  onClick: () => void
  kind: 'tasks' | 'tasksWeek' | 'warnings' | 'people' | 'leave' | 'other'
}

function TileIcon({ kind }: { kind: HomeStatTile['kind'] }) {
  if (kind === 'tasksWeek') return <CheckCircleIcon aria-hidden />
  if (kind === 'warnings') return <ExclamationTriangleIcon aria-hidden />
  if (kind === 'people') return <UsersIcon aria-hidden />
  if (kind === 'leave') return <SunIcon aria-hidden />
  if (kind === 'other') return <CalendarDaysIcon aria-hidden />
  return <ClipboardDocumentCheckIcon aria-hidden />
}

export function HomeStatStrip({ tiles }: { tiles: HomeStatTile[] }) {
  return (
    <section className="dash-card dash-strip" aria-label="Overview">
      {tiles.map((tile) => {
        const warn = tile.kind === 'warnings' && typeof tile.value === 'number' && tile.value > 0
        return (
          <button
            key={tile.id}
            type="button"
            className={warn ? 'dash-stat warn' : 'dash-stat'}
            onClick={tile.onClick}
          >
            {warn ? (
              <svg className="tri" viewBox="0 0 24 24" aria-hidden>
                <path className="fill" d="M10.3 3.6a2 2 0 0 1 3.4 0l8.4 14.6a2 2 0 0 1-1.7 3H3.6a2 2 0 0 1-1.7-3z" />
                <path d="M12 9v5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="12" cy="17.3" r="1.3" fill="#fff" />
              </svg>
            ) : (
              <span className="si">
                <TileIcon kind={tile.kind} />
              </span>
            )}
            <span className="min-w-0">
              <b>{tile.value}</b>
              <span className="l">{tile.label}</span>
            </span>
          </button>
        )
      })}
    </section>
  )
}
