'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid'
import type { HSToolboxTalk, User } from '@/types'
import {
  filterHsRecipients,
  groupRecipientsByTrade,
  recipientTradeFilters,
  userDisplayName,
  userTradeLabel,
} from '@/lib/healthSafety/hsPeople'
import { filterToolboxTalks, groupTalksByCategory, talkTradeFilters } from '@/lib/healthSafety/hsTalks'

export function HsSheet({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden bg-[#F7F8FA] shadow-xl sm:rounded-2xl ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <header className="flex items-center justify-between border-b border-[#EEF0F3] bg-[#F7F8FA] px-4 py-3">
          <button type="button" onClick={onClose} className="text-[13px] font-medium text-[#185FA5]">
            Cancel
          </button>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <span className="w-12" />
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-[#EEF0F3] bg-white px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

export function HsHero({
  title,
  subtitle,
  tone = 'teal',
}: {
  title: string
  subtitle: string
  tone?: 'teal' | 'blue' | 'amber'
}) {
  const bg =
    tone === 'blue'
      ? 'from-[#3f86ff] to-[#2563eb]'
      : tone === 'amber'
        ? 'from-[#f0b429] to-[#d97706]'
        : 'from-[#19c4b3] to-[#0fae9e]'
  return (
    <div className={`flex items-center gap-3.5 rounded-[18px] bg-gradient-to-br ${bg} px-4 py-4 text-white`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white/20">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <div>
        <p className="text-[16px] font-semibold tracking-tight">{title}</p>
        <p className="text-xs text-white/85">{subtitle}</p>
      </div>
    </div>
  )
}

export function HsSectionLabel({
  children,
  extra,
}: {
  children: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#6B7280]">{children}</p>
      {extra}
    </div>
  )
}

export function HsSearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5">
      <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-slate-900 outline-none"
      />
    </div>
  )
}

export function HsChipRow({
  chips,
  selected,
  onSelect,
}: {
  chips: string[]
  selected: string
  onSelect: (value: string) => void
}) {
  if (chips.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
            selected === chip ? 'bg-[#0fae9e] text-white' : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}

export function HsFieldCard({ children }: { children: ReactNode }) {
  return <div className="space-y-2.5 rounded-2xl border border-[#EEF0F3] bg-white p-3.5">{children}</div>
}

export function HsRecipientPicker({
  users,
  selectedIds,
  onChange,
  defaultTrade = 'All',
}: {
  users: User[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  defaultTrade?: string
}) {
  const [search, setSearch] = useState('')
  const [trade, setTrade] = useState(defaultTrade)
  const chips = useMemo(() => recipientTradeFilters(users), [users])
  const filtered = useMemo(() => filterHsRecipients(users, search, trade), [users, search, trade])
  const groups = useMemo(() => groupRecipientsByTrade(filtered), [filtered])
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  const toggle = (id: string) => {
    onChange(selected.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])
  }

  const toggleGroup = (groupUsers: User[]) => {
    const ids = groupUsers.map((user) => user.id)
    const allOn = ids.every((id) => selected.has(id))
    if (allOn) onChange(selectedIds.filter((id) => !ids.includes(id)))
    else onChange(Array.from(new Set([...selectedIds, ...ids])))
  }

  return (
    <div className="space-y-2">
      <HsSearchField value={search} onChange={setSearch} placeholder="Search people or trade" />
      <HsChipRow chips={chips} selected={trade} onSelect={setTrade} />
      <div className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No people match this search.</p>
        ) : (
          groups.map((group) => {
            const allOn = group.users.every((user) => selected.has(user.id))
            return (
              <div key={group.trade} className="border-t border-[#EEF1F5] first:border-t-0">
                <div className="flex items-center justify-between bg-[#F7F8FA] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#6B7280]">
                    {group.trade} · {group.users.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.users)}
                    className="text-[11px] font-semibold text-[#185FA5]"
                  >
                    {allOn ? 'Clear' : 'Select all'}
                  </button>
                </div>
                {group.users.map((user) => {
                  const on = selected.has(user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggle(user.id)}
                      className="flex w-full items-center justify-between gap-3 border-t border-[#EEF1F5] px-4 py-2.5 text-left"
                    >
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{userDisplayName(user)}</span>
                        <span className="text-[11px] text-slate-500">{userTradeLabel(user)}</span>
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          on ? 'border-[#0fae9e] bg-[#0fae9e] text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {on ? <CheckIcon className="h-3 w-3" /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
      <p className="px-1 text-[11px] text-slate-500">
        {selectedIds.length === 0 ? 'Select at least one recipient.' : `${selectedIds.length} selected`}
      </p>
    </div>
  )
}

export function HsTalkPicker({
  talks,
  selectedId,
  onSelect,
}: {
  talks: HSToolboxTalk[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [trade, setTrade] = useState('All')
  const chips = useMemo(() => talkTradeFilters(talks), [talks])
  const filtered = useMemo(() => filterToolboxTalks(talks, search, trade), [talks, search, trade])
  const groups = useMemo(() => groupTalksByCategory(filtered), [filtered])

  return (
    <div className="space-y-2">
      <HsSearchField value={search} onChange={setSearch} placeholder="Search toolbox talks" />
      <HsChipRow chips={chips} selected={trade} onSelect={setTrade} />
      <div className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No talks match this search.</p>
        ) : (
          groups.map((group) => (
            <div key={group.category} className="border-t border-[#EEF1F5] first:border-t-0">
              <p className="bg-[#F7F8FA] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-[#6B7280]">
                {group.category}
              </p>
              {group.talks.map((talk) => {
                const on = selectedId === talk.id
                return (
                  <button
                    key={talk.id}
                    type="button"
                    onClick={() => onSelect(talk.id)}
                    className={`flex w-full items-start justify-between gap-3 border-t border-[#EEF1F5] px-4 py-3 text-left ${
                      on ? 'bg-[#E7F8F6]' : 'bg-white'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{talk.title}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {talk.referenceCode ? `${talk.referenceCode} · ` : ''}
                        {talk.source}
                        {talk.trades.length > 0 ? ` · ${talk.trades.join(', ')}` : ''}
                      </span>
                    </span>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        on ? 'border-[#0fae9e] bg-[#0fae9e] text-white' : 'border-slate-300'
                      }`}
                    >
                      {on ? <CheckIcon className="h-3 w-3" /> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function HsFileButton({
  file,
  onChange,
  accept = '.pdf,image/*',
  label = 'Choose PDF or photo',
}: {
  file: File | null
  onChange: (file: File | null) => void
  accept?: string
  label?: string
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed border-[#C5C9D2] bg-white px-4 py-5 text-center">
      <span className="text-sm font-semibold text-[#185FA5]">{file ? 'Replace file' : label}</span>
      <span className="text-[11px] text-slate-500">{file ? file.name : 'PDF or image · up to 10MB'}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </label>
  )
}

export function HsPrimaryButton({
  children,
  onClick,
  disabled,
  tone = 'teal',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'teal' | 'blue' | 'green'
  type?: 'button' | 'submit'
}) {
  const bg = tone === 'blue' ? 'bg-[#2F73F0]' : tone === 'green' ? 'bg-[#16A34A]' : 'bg-[#0fae9e]'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl py-3 text-sm font-semibold text-white disabled:bg-[#C5C9D2] ${bg}`}
    >
      {children}
    </button>
  )
}
