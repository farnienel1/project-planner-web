'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { useWholesalerStore } from '@/lib/stores/wholesalerStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { EmptyState, ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import { FormLabel, FormSelect } from '@/components/forms/FormShell'
import { MaterialsAddSheet } from '@/components/projects/materials/MaterialsAddSheet'
import type { Project, ProjectMaterialLine } from '@/types'
import {
  FeatureCard,
  FeatureScreen,
  FeatureSectionLabel,
  MaterialsDayStrip,
  MaterialsWeekNavigator,
  StatusPill,
  materialStatusTone,
} from '@/components/projects/features/featureUi'

function MaterialLineCard({ line }: { line: ProjectMaterialLine }) {
  return (
    <FeatureCard className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{line.material}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {line.quantity} {line.unit}
            {line.brand ? ` · ${line.brand}` : ''}
            {line.productCode ? ` · ${line.productCode}` : ''}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">Added by {line.addedBy.split('@')[0]}</p>
        </div>
        <StatusPill label={line.status || 'draft'} tone={materialStatusTone(line.status)} />
      </div>
    </FeatureCard>
  )
}

export function ProjectMaterialsSection({ project }: { project: Project }) {
  const { organization, user } = useAuthStore()
  const { materials, sendRecords, loading, error, loadProjectMaterials, loadSendRecords, saveSendRecord } =
    useMaterialProjectStore()
  const { wholesalers, loadWholesalers } = useWholesalerStore()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedWholesaler, setSelectedWholesaler] = useState('')
  const [sendType, setSendType] = useState<'quote' | 'order'>('quote')
  const [sending, setSending] = useState(false)

  const isOperative = isOperativeMode(user)
  const canSend = !isOperative

  useEffect(() => {
    if (organization?.id) {
      loadProjectMaterials(organization.id, project.id)
      loadSendRecords(organization.id, project.id)
      if (canSend) loadWholesalers(organization.id)
    }
  }, [organization, project.id, loadProjectMaterials, loadSendRecords, loadWholesalers, canSend])

  const projectMaterials = useMemo(() => materials.filter((m) => m.projectId === project.id), [materials, project.id])

  const dayMaterials = useMemo(
    () =>
      projectMaterials
        .filter((m) => isSameDay(new Date(m.date), selectedDate))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [projectMaterials, selectedDate]
  )

  const weekItemCount = useMemo(() => {
    let n = 0
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      n += projectMaterials.filter((m) => isSameDay(new Date(m.date), day)).length
    }
    return n
  }, [projectMaterials, weekStart])

  const draftCount = projectMaterials.filter((m) => `${m.status}`.toLowerCase().includes('draft')).length

  const reloadMaterials = () => {
    if (organization?.id) loadProjectMaterials(organization.id, project.id)
  }

  const sendToWholesaler = async () => {
    if (!organization?.id || !user || !selectedWholesaler || dayMaterials.length === 0) return
    const wholesaler = wholesalers.find((w) => w.id === selectedWholesaler)
    if (!wholesaler) return
    setSending(true)
    try {
      await saveSendRecord(organization.id, {
        id: newUuid(),
        projectId: project.id,
        requestType: sendType,
        sentAt: new Date(),
        materialsDate: selectedDate,
        sentBy: user.email,
        recipients: wholesaler.contacts.map((c) => ({
          name: c.name,
          email: c.email,
          wholesalerName: wholesaler.name,
        })),
        lines: dayMaterials.map((m) => ({
          materialId: m.id,
          name: m.material,
          quantity: m.quantity,
          unit: m.unit,
          brand: m.brand,
          productCode: m.productCode,
        })),
      })
      setShowSend(false)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <FeatureScreen>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <MaterialsWeekNavigator
        weekStart={weekStart}
        itemCount={weekItemCount}
        onPrev={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
      />

      <MaterialsDayStrip
        weekStart={weekStart}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        materials={projectMaterials}
      />

      {/* Day header — matches iOS day toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">
          {format(selectedDate, 'd MMM')} · {dayMaterials.length} item{dayMaterials.length !== 1 ? 's' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canSend && sendRecords.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Quote/order history
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#185FA5] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#134d88]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
          {canSend && (
            <button
              type="button"
              disabled={dayMaterials.length === 0}
              onClick={() => setShowSend(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E1F5EE] bg-[#E1F5EE] text-[#0F6E56] disabled:opacity-40"
              title="Send to wholesaler"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <MaterialsAddSheet
          project={project}
          selectedDate={selectedDate}
          onClose={() => setShowAdd(false)}
          onSaved={reloadMaterials}
        />
      )}

      {/* Day list */}
      <div className="mt-3 space-y-2">
        {dayMaterials.length === 0 && !showAdd ? (
          <FeatureCard className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">No materials for {format(selectedDate, 'd MMM')}</p>
            <p className="mt-1 text-xs text-slate-500">Add what you need delivered on this day.</p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-1 rounded-xl bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white"
            >
              Add material
            </button>
          </FeatureCard>
        ) : (
          dayMaterials.map((line) => <MaterialLineCard key={line.id} line={line} />)
        )}
      </div>

      {canSend && draftCount > 0 && (
        <FeatureCard className="mt-4 border-[#FAEEDA] bg-[#FAEEDA]/40 p-3">
          <p className="text-xs font-semibold text-[#854F0B]">
            {draftCount} draft line{draftCount !== 1 ? 's' : ''} ready to send
          </p>
          <button
            type="button"
            onClick={() => setShowSend(true)}
            className="mt-2 w-full rounded-xl bg-[#0F6E56] py-2.5 text-sm font-semibold text-white"
          >
            Send to wholesaler
          </button>
        </FeatureCard>
      )}

      {/* Send sheet */}
      {showSend && canSend && (
        <FeatureCard className="mt-4 p-4">
          <p className="text-sm font-bold text-slate-900">Send list · {format(selectedDate, 'd MMM')}</p>
          <p className="mt-1 text-xs text-slate-500">{dayMaterials.length} lines for this day</p>
          <div className="mt-3 space-y-3">
            <div>
              <FormLabel>Wholesaler</FormLabel>
              <FormSelect value={selectedWholesaler} onChange={(e) => setSelectedWholesaler(e.target.value)}>
                <option value="">Select wholesaler</option>
                {wholesalers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div>
              <FormLabel>Request type</FormLabel>
              <FormSelect value={sendType} onChange={(e) => setSendType(e.target.value as 'quote' | 'order')}>
                <option value="quote">Quote</option>
                <option value="order">Order</option>
              </FormSelect>
            </div>
            <button
              type="button"
              disabled={sending || !selectedWholesaler}
              onClick={sendToWholesaler}
              className="w-full rounded-xl bg-[#0F6E56] py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => setShowSend(false)}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600"
            >
              Cancel
            </button>
          </div>
        </FeatureCard>
      )}

      {showHistory && sendRecords.length > 0 && (
        <div className="mt-4">
          <FeatureSectionLabel>Send history</FeatureSectionLabel>
          <div className="space-y-2">
            {sendRecords.map((record) => (
              <FeatureCard key={record.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold capitalize text-slate-800">{record.requestType}</span>
                  <StatusPill label="Sent" tone="green" />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {format(record.sentAt, 'd MMM yyyy HH:mm')} · {record.sentBy.split('@')[0]}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {record.recipients.map((r) => r.wholesalerName || r.email).join(', ')}
                </p>
              </FeatureCard>
            ))}
          </div>
        </div>
      )}
    </FeatureScreen>
  )
}
