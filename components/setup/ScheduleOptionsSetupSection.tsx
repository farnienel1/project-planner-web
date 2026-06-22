'use client'

import { useState } from 'react'
import {
  SetupCard,
  SetupNote,
  SetupSectionLabel,
  SetupToggle,
} from '@/components/setup/setupFormPrimitives'
import type { MyScheduleOptions } from '@/lib/settings/organizationSettings'

type ScheduleOptionsSetupSectionProps = {
  value: MyScheduleOptions
  onChange: (value: MyScheduleOptions) => void
}

export function ScheduleOptionsSetupSection({ value, onChange }: ScheduleOptionsSetupSectionProps) {
  const [newItem, setNewItem] = useState('')

  function patch(partial: Partial<MyScheduleOptions>) {
    onChange({ ...value, ...partial })
  }

  function addCustomItem() {
    const trimmed = newItem.trim()
    if (!trimmed || value.customItems.includes(trimmed)) return
    patch({
      customItems: [...value.customItems, trimmed],
      customItemEnabled: { ...value.customItemEnabled, [trimmed]: true },
    })
    setNewItem('')
  }

  return (
    <div className="space-y-4">
      <SetupNote tone="blue">
        My Schedule: add or remove admin/manager additional options within My Schedule. Office, Working From Home and
        Site Survey have been included as standard.
      </SetupNote>

      <div>
        <SetupSectionLabel>Additional options</SetupSectionLabel>
        <SetupCard>
          <SetupToggle
            label="Office"
            checked={value.showOffice}
            onChange={(showOffice) => patch({ showOffice })}
          />
          <SetupToggle
            label="Working from home"
            checked={value.showWorkingFromHome}
            onChange={(showWorkingFromHome) => patch({ showWorkingFromHome })}
          />
          <SetupToggle
            label="Site survey"
            checked={value.showSiteSurvey}
            onChange={(showSiteSurvey) => patch({ showSiteSurvey })}
          />
          {value.customItems.map((item) => (
            <SetupToggle
              key={item}
              label={item}
              checked={value.customItemEnabled[item] ?? true}
              onChange={(enabled) => {
                if (!enabled) {
                  patch({
                    customItems: value.customItems.filter((entry) => entry !== item),
                    customItemEnabled: Object.fromEntries(
                      Object.entries(value.customItemEnabled).filter(([key]) => key !== item)
                    ),
                  })
                } else {
                  patch({
                    customItemEnabled: { ...value.customItemEnabled, [item]: true },
                  })
                }
              }}
            />
          ))}
        </SetupCard>
      </div>

      <div>
        <SetupSectionLabel>Add custom option</SetupSectionLabel>
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomItem()
              }
            }}
            placeholder="e.g. Training"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={addCustomItem}
            disabled={!newItem.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Create an extra booking option for admin/manager My Schedule — for example Training, CPD or site visits.
        </p>
      </div>
    </div>
  )
}
