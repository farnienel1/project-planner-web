'use client'

import { Icon, type IconName } from './GuidedOrgSetup'

type SettingsPreviewItem = {
  icon: IconName
  title: string
  description: string
}

const SETTINGS_PREVIEW: SettingsPreviewItem[] = [
  {
    icon: 'building',
    title: 'Company details',
    description: 'Your name, logo, address and currency — shown on reports and the iOS app header.',
  },
  {
    icon: 'clock',
    title: 'Working hours & overtime',
    description: 'Standard shifts, breaks and overtime multipliers, set per day of the week.',
  },
  {
    icon: 'calendar',
    title: 'Annual leave & bank holidays',
    description: 'Days per year, carry-over rules, and the region your bank holidays follow.',
  },
  {
    icon: 'alert',
    title: 'Warnings',
    description: 'Detection windows, excluded users and severity levels for scheduling conflicts.',
  },
  {
    icon: 'creditcard',
    title: 'Payment runs & timesheets',
    description: 'How often you pay, recurring date ranges, and how timesheets roll up.',
  },
  {
    icon: 'shield',
    title: 'Roles & permissions',
    description: 'Fine-grained access for admins, managers and operatives across every module.',
  },
]

const GUIDED_PREVIEW: { icon: IconName; title: string }[] = [
  { icon: 'manager', title: 'Add your first manager' },
  { icon: 'operative', title: 'Add your first operative' },
  { icon: 'project', title: 'Create your first project' },
  { icon: 'client', title: 'Add your first client' },
  { icon: 'subcontractor', title: 'Add a sub contractor' },
  { icon: 'wholesaler', title: 'Add a wholesaler' },
  { icon: 'skill', title: 'Add a skill' },
  { icon: 'qualification', title: 'Add a qualification' },
  { icon: 'jobtype', title: 'Add a job type' },
]

type SetupExplainerProps = {
  organizationName: string
  firstName: string
  onBack: () => void
  onContinue: () => void
}

export function SetupExplainer({ organizationName, firstName, onBack, onContinue }: SetupExplainerProps) {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 p-7 text-white sm:p-9">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
            <Icon name="rocket" className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
              {firstName ? `Welcome, ${firstName}` : 'Welcome'}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              {organizationName ? `Here's what ${organizationName} gets next` : "Here's what your organisation gets next"}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-blue-50">
              Nothing on this page changes any settings — it's just a quick look at what you&rsquo;ll be in control of,
              and the handful of things we&rsquo;ll set up together right after this.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-9">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">What you&rsquo;ll be in control of</h3>
        <p className="mt-1 text-sm text-slate-600">
          Every one of these lives in Settings once you&rsquo;re in — you can fine-tune them any time.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SETTINGS_PREVIEW.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Icon name={item.icon} className="h-5 w-5 text-slate-600" />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-9">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Let&rsquo;s get your team &amp; data ready</h3>
        <p className="mt-1 text-sm text-slate-600">
          Nine quick steps, right after this page. We&rsquo;ll explain each one as we go — no guesswork.
        </p>
        <ol className="mt-4 space-y-2">
          {GUIDED_PREVIEW.map((item, index) => (
            <li
              key={item.title}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                {index + 1}
              </span>
              <Icon name={item.icon} className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="text-sm font-semibold text-slate-800">{item.title}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-9 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Start guided setup
        </button>
      </div>
    </div>
  )
}
