'use client'

export function ScheduleQuickSelect({
  activeDays,
  onSelect,
}: {
  activeDays: number | null
  onSelect: (days: number) => void
}) {
  const options = [
    { days: 1, label: 'Today' },
    { days: 3, label: '3 days' },
    { days: 5, label: '5 days' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ days, label }) => (
        <button
          key={days}
          type="button"
          onClick={() => onSelect(days)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            activeDays === days
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 bg-white text-blue-700 hover:bg-blue-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
