'use client'

import { useState } from 'react'
import { FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'

/* ----------------------------------------------------------------------- */
/*  Data shape — mirrors the real Firestore writes this will trigger once  */
/*  it moves behind the Stripe paywall (see handoff notes at bottom).      */
/* ----------------------------------------------------------------------- */

export type GuidedSetupData = {
  operativeSkipped?: boolean
  manager: {
    firstName: string
    surname: string
    email: string
    mobile: string
    dayRate: string
  }
  operative: {
    firstName: string
    surname: string
    email: string
    mobile: string
    employmentType: 'PAYE' | 'Self-Employed'
    dayRate: string
  }
  project: {
    jobNumber: string
    siteName: string
    jobType: string
    startDate: string
    endDate: string
    clientName: string
  }
  client: {
    name: string
    email: string
    phone: string
  }
  subcontractor: {
    name: string
    tradeType: string
    website: string
    address: string
    contactName: string
    contactEmail: string
    contactNumber: string
  }
  wholesaler: {
    name: string
    trade: string
    address: string
    accountNumber: string
    contactName: string
    contactEmail: string
  }
  skill: {
    name: string
    trade: string
  }
  qualification: {
    name: string
    hasEndDate: boolean
  }
  jobType: {
    name: string
  }
}

export function createEmptyGuidedSetupData(): GuidedSetupData {
  return {
    operativeSkipped: false,
    manager: { firstName: '', surname: '', email: '', mobile: '', dayRate: '' },
    operative: { firstName: '', surname: '', email: '', mobile: '', employmentType: 'PAYE', dayRate: '' },
    project: { jobNumber: '', siteName: '', jobType: 'CAT A', startDate: '', endDate: '', clientName: '' },
    client: { name: '', email: '', phone: '' },
    subcontractor: { name: '', tradeType: '', website: '', address: '', contactName: '', contactEmail: '', contactNumber: '' },
    wholesaler: { name: '', trade: '', address: '', accountNumber: '', contactName: '', contactEmail: '' },
    skill: { name: '', trade: '' },
    qualification: { name: '', hasEndDate: false },
    jobType: { name: '' },
  }
}

const PROJECT_JOB_TYPES = ['CAT A', 'CAT B', 'Small Works', 'Maintenance']

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ----------------------------------------------------------------------- */
/*  Icons — monoline, matches the FormBackLink arrow already in the app    */
/* ----------------------------------------------------------------------- */

export type IconName =
  | 'manager'
  | 'operative'
  | 'project'
  | 'client'
  | 'subcontractor'
  | 'wholesaler'
  | 'skill'
  | 'qualification'
  | 'jobtype'
  | 'check'
  | 'building'
  | 'clock'
  | 'calendar'
  | 'alert'
  | 'creditcard'
  | 'shield'
  | 'rocket'

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.75,
  }
  switch (name) {
    case 'manager':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 10.5 1.25 1.25L18.25 9" />
        </svg>
      )
    case 'operative':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5 12 6l7 3.5" />
        </svg>
      )
    case 'project':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
        </svg>
      )
    case 'client':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 21v-7h5a1 1 0 0 1 1 1v6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h1M8 11h1M8 15h1" />
        </svg>
      )
    case 'subcontractor':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16V7a1 1 0 0 1 1-1h9v10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10h4l3 3v3h-2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 19a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 19a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z" />
        </svg>
      )
    case 'wholesaler':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 7 8.5-4 8.5 4-8.5 4-8.5-4Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7v10l8.5 4 8.5-4V7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v10" />
        </svg>
      )
    case 'skill':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L6.6 19.3l1.3-6L3.3 9.2l6.1-.6L12 3Z"
          />
        </svg>
      )
    case 'qualification':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5" />
        </svg>
      )
    case 'jobtype':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.5 3h-5a1 1 0 0 0-.7.3L3.3 5.8a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l5-5a1 1 0 0 0 0-1.4l-9-9a1 1 0 0 0-.7-.3Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h.01" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
      )
    case 'building':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-4h6v4M9 7h.01M9 11h.01M15 7h.01M15 11h.01" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3.5 2" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 9h14M7 3v3M17 3v3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.9 2.7 17a1.5 1.5 0 0 0 1.3 2.2h16a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" />
        </svg>
      )
    case 'creditcard':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M6.5 14.5h3" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5 6v5c0 4.6 3 7.8 7 10 4-2.2 7-5.4 7-10V6l-7-3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12 1.8 1.8L14.5 10" />
        </svg>
      )
    case 'rocket':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2.5c2.5 1.5 4 4.3 4 7.5 0 2-.7 4-2 6h-4c-1.3-2-2-4-2-6 0-3.2 1.5-6 4-7.5Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v3M9 13.5 6.5 16M15 13.5 17.5 16M9.5 18.5h5l-1 2.5h-3l-1-2.5Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        </svg>
      )
  }
}

/* ----------------------------------------------------------------------- */
/*  Step definitions                                                       */
/* ----------------------------------------------------------------------- */

type StepKey =
  | 'manager'
  | 'operative'
  | 'project'
  | 'client'
  | 'subcontractor'
  | 'wholesaler'
  | 'skill'
  | 'qualification'
  | 'jobtype'

type StepMeta = {
  key: StepKey
  icon: IconName
  label: string
  accent: { tile: string; ring: string; text: string; bar: string }
}

const STEP_META: StepMeta[] = [
  { key: 'manager', icon: 'manager', label: 'Manager', accent: { tile: 'bg-blue-50', ring: 'ring-blue-100', text: 'text-blue-600', bar: 'bg-blue-600' } },
  { key: 'operative', icon: 'operative', label: 'Operative', accent: { tile: 'bg-sky-50', ring: 'ring-sky-100', text: 'text-sky-600', bar: 'bg-sky-500' } },
  { key: 'project', icon: 'project', label: 'Project', accent: { tile: 'bg-indigo-50', ring: 'ring-indigo-100', text: 'text-indigo-600', bar: 'bg-indigo-600' } },
  { key: 'client', icon: 'client', label: 'Client', accent: { tile: 'bg-emerald-50', ring: 'ring-emerald-100', text: 'text-emerald-600', bar: 'bg-emerald-600' } },
  { key: 'subcontractor', icon: 'subcontractor', label: 'Sub contractor', accent: { tile: 'bg-violet-50', ring: 'ring-violet-100', text: 'text-violet-600', bar: 'bg-violet-600' } },
  { key: 'wholesaler', icon: 'wholesaler', label: 'Wholesaler', accent: { tile: 'bg-amber-50', ring: 'ring-amber-100', text: 'text-amber-600', bar: 'bg-amber-500' } },
  { key: 'skill', icon: 'skill', label: 'Skill', accent: { tile: 'bg-orange-50', ring: 'ring-orange-100', text: 'text-orange-600', bar: 'bg-orange-500' } },
  { key: 'qualification', icon: 'qualification', label: 'Qualification', accent: { tile: 'bg-teal-50', ring: 'ring-teal-100', text: 'text-teal-600', bar: 'bg-teal-600' } },
  { key: 'jobtype', icon: 'jobtype', label: 'Job type', accent: { tile: 'bg-slate-100', ring: 'ring-slate-200', text: 'text-slate-700', bar: 'bg-slate-700' } },
]

/* ----------------------------------------------------------------------- */
/*  Shared layout chrome                                                   */
/* ----------------------------------------------------------------------- */

function MiniProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEP_META.map((meta, index) => (
        <div
          key={meta.key}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            index < current ? 'bg-emerald-500' : index === current ? meta.accent.bar : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">{children}</div>
  )
}

function StepHeader({
  meta,
  index,
  title,
  description,
}: {
  meta: StepMeta
  index: number
  title: string
  description: string
}) {
  return (
    <div className="mb-7">
      <MiniProgress current={index} />
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">
        Step {index + 1} of {STEP_META.length} &middot; Team &amp; data setup
      </p>
      <div className="mt-3 flex items-start gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${meta.accent.tile} ring-1 ${meta.accent.ring}`}>
          <Icon name={meta.icon} className={`h-7 w-7 ${meta.accent.text}`} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">{title}</h2>
          <p className="mt-1.5 max-w-xl text-sm text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  )
}

function StepNav({
  onBack,
  onNext,
  onSkip,
  skipLabel,
  nextLabel = 'Continue',
  disabled,
}: {
  onBack: () => void
  onNext: () => void
  onSkip?: () => void
  skipLabel?: string
  nextLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
      <button
        type="button"
        onClick={onBack}
        className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Back
      </button>
      {onSkip && skipLabel && (
        <button
          type="button"
          onClick={onSkip}
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          {skipLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel}
      </button>
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/*  Main component                                                         */
/* ----------------------------------------------------------------------- */

type GuidedOrgSetupProps = {
  data: GuidedSetupData
  onChange: (next: GuidedSetupData) => void
  stepIndex: number
  onStepIndexChange: (index: number) => void
  organizationName: string
  onExitToExplainer: () => void
  onComplete: () => void
}

export function GuidedOrgSetup({
  data,
  onChange,
  stepIndex,
  onStepIndexChange,
  organizationName,
  onExitToExplainer,
  onComplete,
}: GuidedOrgSetupProps) {
  const [touched, setTouched] = useState(false)

  const isRecap = stepIndex >= STEP_META.length
  const meta = !isRecap ? STEP_META[stepIndex] : null

  function update<K extends Exclude<keyof GuidedSetupData, 'operativeSkipped'>>(
    key: K,
    patch: Partial<GuidedSetupData[K]>
  ) {
    onChange({ ...data, [key]: { ...data[key], ...patch } })
  }

  function validate(): string | null {
    switch (meta?.key) {
      case 'manager': {
        const m = data.manager
        if (!m.firstName.trim() || !m.surname.trim()) return "Enter the manager's first and last name."
        if (!EMAIL_PATTERN.test(m.email.trim())) return 'Enter a valid email address.'
        return null
      }
      case 'operative': {
        const o = data.operative
        if (!o.firstName.trim() || !o.surname.trim()) return "Enter the operative's first and last name."
        if (!EMAIL_PATTERN.test(o.email.trim())) return 'Enter a valid email address.'
        return null
      }
      case 'project': {
        const p = data.project
        if (!p.jobNumber.trim() || !p.siteName.trim()) return 'Job number and site name are required.'
        if (!p.startDate || !p.endDate) return 'Start and end dates are required.'
        if (!p.clientName.trim()) return "Enter a client name — you'll add their full details next."
        return null
      }
      case 'client': {
        if (!data.client.name.trim()) return 'Enter a client name.'
        return null
      }
      case 'subcontractor': {
        const s = data.subcontractor
        if (!s.name.trim() || !s.tradeType.trim()) return 'Firm name and trade type are required.'
        return null
      }
      case 'wholesaler': {
        const w = data.wholesaler
        if (!w.name.trim()) return 'Enter the wholesaler name.'
        if (!w.contactName.trim() || !EMAIL_PATTERN.test(w.contactEmail.trim())) {
          return 'A primary contact name and valid email are required.'
        }
        return null
      }
      case 'skill': {
        if (!data.skill.name.trim() || !data.skill.trade.trim()) return 'Skill name and trade are required.'
        return null
      }
      case 'qualification': {
        if (!data.qualification.name.trim()) return 'Enter a qualification name.'
        return null
      }
      case 'jobtype': {
        if (!data.jobType.name.trim()) return 'Enter a job type name.'
        return null
      }
      default:
        return null
    }
  }

  const validationError = touched ? validate() : null
  const canAdvance = validate() === null

  function goNext() {
    setTouched(true)
    if (validate() !== null) return
    setTouched(false)

    // Quietly carry the project's quick-add client name into the Client step.
    if (meta?.key === 'project' && !data.client.name.trim()) {
      onChange({ ...data, client: { ...data.client, name: data.project.clientName } })
    }

    onStepIndexChange(stepIndex + 1)
  }

  function skipOperativeStep() {
    setTouched(false)
    onChange({
      ...data,
      operativeSkipped: true,
      operative: {
        firstName: '',
        surname: '',
        email: '',
        mobile: '',
        employmentType: 'PAYE',
        dayRate: '',
      },
    })
    onStepIndexChange(stepIndex + 1)
  }

  function goBack() {
    setTouched(false)
    if (stepIndex === 0) {
      onExitToExplainer()
      return
    }
    onStepIndexChange(stepIndex - 1)
  }

  if (isRecap) {
    return <RecapStep data={data} organizationName={organizationName} onBack={() => onStepIndexChange(STEP_META.length - 1)} onComplete={onComplete} />
  }

  return (
    <div>
      {meta?.key === 'manager' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Add your first manager"
            description="Managers oversee projects, approve timesheets and annual leave, and keep schedules on track. They can also be given access to settings like users, skills and qualifications."
          />
          <NoteBox>
            When setting up this user, try choose a person who will be a manager of your first project. That way, on
            the next step, you can assign them to it straight away.
          </NoteBox>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <FormLabel required>First name</FormLabel>
              <FormInput value={data.manager.firstName} onChange={(e) => update('manager', { firstName: e.target.value })} />
            </div>
            <div>
              <FormLabel required>Last name</FormLabel>
              <FormInput value={data.manager.surname} onChange={(e) => update('manager', { surname: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <FormLabel required>Email address</FormLabel>
              <FormInput type="email" value={data.manager.email} onChange={(e) => update('manager', { email: e.target.value })} />
            </div>
            <div>
              <FormLabel>Mobile number</FormLabel>
              <FormInput value={data.manager.mobile} onChange={(e) => update('manager', { mobile: e.target.value })} />
            </div>
            <div>
              <FormLabel>Day rate (optional)</FormLabel>
              <FormInput type="number" step="0.01" placeholder="e.g. 250" value={data.manager.dayRate} onChange={(e) => update('manager', { dayRate: e.target.value })} />
            </div>
          </div>
        </>
      )}

      {meta?.key === 'operative' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Add your first operative"
            description="Operatives are your tradespeople on the tools. They get a focused view — their schedule, the projects they're booked on, and their own annual leave — without access to admin settings, other staff, or company financials."
          />
          <NoteBox>
            This restricted access matters on site: operatives see exactly what they need for the day&rsquo;s work,
            nothing more, which keeps schedules and project details tidy and reduces accidental changes.
          </NoteBox>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <FormLabel required>First name</FormLabel>
              <FormInput value={data.operative.firstName} onChange={(e) => update('operative', { firstName: e.target.value })} />
            </div>
            <div>
              <FormLabel required>Last name</FormLabel>
              <FormInput value={data.operative.surname} onChange={(e) => update('operative', { surname: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <FormLabel required>Email address</FormLabel>
              <FormInput type="email" value={data.operative.email} onChange={(e) => update('operative', { email: e.target.value })} />
            </div>
            <div>
              <FormLabel>Mobile number</FormLabel>
              <FormInput value={data.operative.mobile} onChange={(e) => update('operative', { mobile: e.target.value })} />
            </div>
            <div>
              <FormLabel>Employment type</FormLabel>
              <div className="flex gap-2">
                {(['PAYE', 'Self-Employed'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update('operative', { employmentType: opt })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      data.operative.employmentType === opt
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FormLabel>Day rate (optional)</FormLabel>
              <FormInput type="number" step="0.01" placeholder="e.g. 200" value={data.operative.dayRate} onChange={(e) => update('operative', { dayRate: e.target.value })} />
            </div>
          </div>
          {data.manager.firstName && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Reports to {data.manager.firstName} {data.manager.surname}
            </p>
          )}
        </>
      )}

      {meta?.key === 'project' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Create your first project"
            description="Projects are the core of Project Planner — schedule, tasks, timesheets, site audits and warnings all live inside one. Assign the manager you just added so they're ready to run it from day one."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <FormLabel required>Job number</FormLabel>
              <FormInput placeholder="e.g. 1042" value={data.project.jobNumber} onChange={(e) => update('project', { jobNumber: e.target.value })} />
            </div>
            <div>
              <FormLabel required>Site name</FormLabel>
              <FormInput placeholder="e.g. The Arena, Enfield" value={data.project.siteName} onChange={(e) => update('project', { siteName: e.target.value })} />
            </div>
            <div>
              <FormLabel>Job type</FormLabel>
              <FormSelect value={data.project.jobType} onChange={(e) => update('project', { jobType: e.target.value })}>
                {PROJECT_JOB_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </FormSelect>
            </div>
            <div>
              <FormLabel required>Client name</FormLabel>
              <FormInput
                placeholder="e.g. RED Construction"
                value={data.project.clientName}
                onChange={(e) => update('project', { clientName: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">You&rsquo;ll add their contact details on the next step.</p>
            </div>
            <div>
              <FormLabel required>Start date</FormLabel>
              <FormInput type="date" value={data.project.startDate} onChange={(e) => update('project', { startDate: e.target.value })} />
            </div>
            <div>
              <FormLabel required>End date</FormLabel>
              <FormInput type="date" value={data.project.endDate} onChange={(e) => update('project', { endDate: e.target.value })} />
            </div>
          </div>
          {data.manager.firstName && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              Managed by {data.manager.firstName} {data.manager.surname}
            </p>
          )}
        </>
      )}

      {meta?.key === 'client' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Add this client's details"
            description="Clients are linked to your projects and small works, so every job is tied to who you're delivering it for — and it's ready to drop onto invoices and reports."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormLabel required>Client name</FormLabel>
              <FormInput value={data.client.name} onChange={(e) => update('client', { name: e.target.value })} />
            </div>
            <div>
              <FormLabel>Email (optional)</FormLabel>
              <FormInput type="email" value={data.client.email} onChange={(e) => update('client', { email: e.target.value })} />
            </div>
            <div>
              <FormLabel>Phone (optional)</FormLabel>
              <FormInput value={data.client.phone} onChange={(e) => update('client', { phone: e.target.value })} />
            </div>
          </div>
        </>
      )}

      {meta?.key === 'subcontractor' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Add a sub contractor"
            description="Sub contractors don't get access to Project Planner — but you can book their firm onto projects and small works, so you always know where they're working and when."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <FormLabel required>Firm name</FormLabel>
              <FormInput value={data.subcontractor.name} onChange={(e) => update('subcontractor', { name: e.target.value })} />
            </div>
            <div>
              <FormLabel required>Trade type</FormLabel>
              <FormInput placeholder="e.g. Dry Lining" value={data.subcontractor.tradeType} onChange={(e) => update('subcontractor', { tradeType: e.target.value })} />
            </div>
            <div>
              <FormLabel>Website (optional)</FormLabel>
              <FormInput value={data.subcontractor.website} onChange={(e) => update('subcontractor', { website: e.target.value })} />
            </div>
            <div>
              <FormLabel>Address (optional)</FormLabel>
              <FormInput value={data.subcontractor.address} onChange={(e) => update('subcontractor', { address: e.target.value })} />
            </div>
            <div>
              <FormLabel>Contact name (optional)</FormLabel>
              <FormInput value={data.subcontractor.contactName} onChange={(e) => update('subcontractor', { contactName: e.target.value })} />
            </div>
            <div>
              <FormLabel>Contact email (optional)</FormLabel>
              <FormInput type="email" value={data.subcontractor.contactEmail} onChange={(e) => update('subcontractor', { contactEmail: e.target.value })} />
            </div>
          </div>
        </>
      )}

      {meta?.key === 'wholesaler' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Add a wholesaler"
            description="Wholesalers are your material suppliers — used whenever someone on your team requests a quotation or places an order on a project or small works job."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <FormLabel required>Wholesaler name</FormLabel>
              <FormInput value={data.wholesaler.name} onChange={(e) => update('wholesaler', { name: e.target.value })} />
            </div>
            <div>
              <FormLabel>Trade / category (optional)</FormLabel>
              <FormInput placeholder="e.g. Electrical" value={data.wholesaler.trade} onChange={(e) => update('wholesaler', { trade: e.target.value })} />
            </div>
            <div>
              <FormLabel>Address (optional)</FormLabel>
              <FormInput value={data.wholesaler.address} onChange={(e) => update('wholesaler', { address: e.target.value })} />
            </div>
            <div>
              <FormLabel>Account number (optional)</FormLabel>
              <FormInput value={data.wholesaler.accountNumber} onChange={(e) => update('wholesaler', { accountNumber: e.target.value })} />
            </div>
            <div>
              <FormLabel required>Primary contact name</FormLabel>
              <FormInput value={data.wholesaler.contactName} onChange={(e) => update('wholesaler', { contactName: e.target.value })} />
            </div>
            <div>
              <FormLabel required>Primary contact email</FormLabel>
              <FormInput type="email" value={data.wholesaler.contactEmail} onChange={(e) => update('wholesaler', { contactEmail: e.target.value })} />
            </div>
          </div>
        </>
      )}

      {meta?.key === 'skill' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Add a skill"
            description="Skills sit under a trade and can be assigned to any operative — regardless of their own trade — so you can see at a glance who's qualified for a particular kind of work."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <FormLabel required>Skill name</FormLabel>
              <FormInput placeholder="e.g. Containment" value={data.skill.name} onChange={(e) => update('skill', { name: e.target.value })} />
            </div>
            <div>
              <FormLabel required>Trade</FormLabel>
              <FormInput placeholder="e.g. Electrician" value={data.skill.trade} onChange={(e) => update('skill', { trade: e.target.value })} />
            </div>
          </div>
        </>
      )}

      {meta?.key === 'qualification' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Add a qualification"
            description="Qualifications track certifications against operative profiles — things like SMSTS, SSSTS or NVQ levels — with optional expiry tracking so renewals never get missed."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormLabel required>Qualification name</FormLabel>
              <FormInput placeholder="e.g. SMSTS" value={data.qualification.name} onChange={(e) => update('qualification', { name: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={data.qualification.hasEndDate}
                onChange={(e) => update('qualification', { hasEndDate: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              This qualification has an expiry date
            </label>
          </div>
        </>
      )}

      {meta?.key === 'jobtype' && (
        <>
          <StepHeader
            meta={meta}
            index={stepIndex}
            title="Add a job type"
            description="Job types classify the kind of work on a project or small works job — useful for reporting and filtering across your organisation."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormLabel required>Job type name</FormLabel>
              <FormInput placeholder="e.g. Dilapidations" value={data.jobType.name} onChange={(e) => update('jobType', { name: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">Examples: CAT A, CAT B, Dilapidations, Reactive Maintenance.</p>
            </div>
          </div>
        </>
      )}

      {validationError && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{validationError}</p>
      )}

      <StepNav
        onBack={goBack}
        onNext={goNext}
        onSkip={meta?.key === 'operative' ? skipOperativeStep : undefined}
        skipLabel={meta?.key === 'operative' ? 'Skip for now' : undefined}
        disabled={touched && !canAdvance}
        nextLabel={stepIndex === STEP_META.length - 1 ? 'Review setup' : 'Continue'}
      />
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/*  Recap screen                                                           */
/* ----------------------------------------------------------------------- */

function RecapRow({ icon, label, value, accent }: { icon: IconName; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
      <Icon name="check" className="h-5 w-5 shrink-0 text-emerald-500" />
    </div>
  )
}

function RecapStep({
  data,
  organizationName,
  onBack,
  onComplete,
}: {
  data: GuidedSetupData
  organizationName: string
  onBack: () => void
  onComplete: () => void
}) {
  return (
    <div>
      <div className="mb-7 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Team &amp; data setup complete</p>
        <h2 className="mt-2 text-2xl font-extrabold">
          {organizationName ? `${organizationName} is ready to go` : 'Your organisation is ready to go'}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-blue-50">
          Here&rsquo;s everything you&rsquo;ve set up. You&rsquo;ll be able to add more people, projects and data any
          time from Settings once you&rsquo;re in.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <RecapRow icon="manager" label="Manager" value={`${data.manager.firstName} ${data.manager.surname}`.trim() || '—'} accent="bg-blue-50 text-blue-600" />
        <RecapRow
          icon="operative"
          label="Operative"
          value={
            data.operativeSkipped
              ? 'Skipped — add later'
              : `${data.operative.firstName} ${data.operative.surname}`.trim() || '—'
          }
          accent="bg-sky-50 text-sky-600"
        />
        <RecapRow icon="project" label="Project" value={data.project.siteName || '—'} accent="bg-indigo-50 text-indigo-600" />
        <RecapRow icon="client" label="Client" value={data.client.name || '—'} accent="bg-emerald-50 text-emerald-600" />
        <RecapRow icon="subcontractor" label="Sub contractor" value={data.subcontractor.name || '—'} accent="bg-violet-50 text-violet-600" />
        <RecapRow icon="wholesaler" label="Wholesaler" value={data.wholesaler.name || '—'} accent="bg-amber-50 text-amber-600" />
        <RecapRow icon="skill" label="Skill" value={data.skill.name || '—'} accent="bg-orange-50 text-orange-600" />
        <RecapRow icon="qualification" label="Qualification" value={data.qualification.name || '—'} accent="bg-teal-50 text-teal-600" />
        <RecapRow icon="jobtype" label="Job type" value={data.jobType.name || '—'} accent="bg-slate-100 text-slate-700" />
      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Continue to plans
        </button>
      </div>
    </div>
  )
}

export const GUIDED_SETUP_STEP_COUNT = STEP_META.length
