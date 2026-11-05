/**
 * Home page header (owner decisions 6 and 13, 5 Nov 2026). Presentational: the greeting, date line and buttons are
 * passed in; each button runs the handler the old hero ran. Customise (admins) opens the existing Dashboard metrics
 * chooser; Weekly report shows only when `canViewWeeklyReports` (admin-only from 1.32.0).
 */

import { CalendarDaysIcon, DocumentChartBarIcon, PlusIcon, Squares2X2Icon } from '@heroicons/react/24/outline'

export function HomeHeader(props: {
  greeting: string
  dateLine: string
  subtitle: string
  onCustomise?: () => void
  onDailyOverview?: () => void
  onWeeklyReport?: () => void
  onBookLabour?: () => void
}) {
  const { greeting, dateLine, subtitle, onCustomise, onDailyOverview, onWeeklyReport, onBookLabour } = props
  return (
    <div className="dash-head">
      <div>
        <h1>{greeting}</h1>
        <p>
          {dateLine} · {subtitle}
        </p>
      </div>
      <div className="dash-actions">
        {onCustomise ? (
          <button type="button" className="dash-btn" onClick={onCustomise} aria-label="Customise dashboard metrics">
            <Squares2X2Icon aria-hidden />
            Customise
          </button>
        ) : null}
        {onDailyOverview ? (
          <button type="button" className="dash-btn" onClick={onDailyOverview}>
            <CalendarDaysIcon aria-hidden />
            Daily overview
          </button>
        ) : null}
        {onWeeklyReport ? (
          <button type="button" className="dash-btn" onClick={onWeeklyReport}>
            <DocumentChartBarIcon aria-hidden />
            Weekly report
          </button>
        ) : null}
        {onBookLabour ? (
          <button type="button" className="dash-btn primary" onClick={onBookLabour}>
            <PlusIcon aria-hidden />
            Book labour
          </button>
        ) : null}
      </div>
    </div>
  )
}
