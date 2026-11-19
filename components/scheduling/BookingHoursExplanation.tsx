'use client'

/**
 * Rulebook 1.39.0 (`bookingHoursExplanation`): the day's rule and the steps that make up a booking's hours, e.g.
 * "Saturday full day: 07:30–14:00 counts as 8h, hours outside it at 2×" then
 * "Booked 07:30–10:30 = 3h of the 6.5h window → 8h × 3 ÷ 6.5 = 3.69h". Shows the rulebook's text only; nothing is
 * worked out here. The same rows are drawn on iOS (`BookingHoursExplanationView`).
 */
export function BookingHoursExplanation({
  rule,
  steps,
  className = '',
}: {
  rule: string
  steps: ReadonlyArray<string>
  className?: string
}) {
  if (!rule && steps.length === 0) return null
  return (
    <div className={`space-y-0.5 ${className}`} data-testid="booking-hours-explanation">
      {rule ? <p className="text-xs font-medium text-slate-500">{rule}</p> : null}
      {steps.map((step, index) => (
        <p
          key={`${index}-${step}`}
          className={`text-xs tabular-nums ${step.startsWith('→') ? 'font-semibold text-slate-800' : 'text-slate-700'}`}
        >
          {step}
        </p>
      ))}
    </div>
  )
}
