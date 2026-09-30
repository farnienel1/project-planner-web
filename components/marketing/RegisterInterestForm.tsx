'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useAuthStore } from '@/lib/stores/authStore'
import { buildInterestDraft, type InterestFieldErrors } from '@/lib/interest/registration'

const ROLES = [
  'Owner / Director',
  'Contracts Manager',
  'Project Manager',
  'Operations / Office Manager',
  'Commercial / QS',
  'Supervisor',
  'Other',
] as const

const TEAM_SIZES = ['1–5', '6–15', '16–40', '41–100', '100+'] as const

const SECTORS = ['CAT A', 'CAT B', 'Residential', 'High-end residential', 'Hotels', 'Decarbonisation', 'Maintenance'] as const

const CURRENT_TOOLS = [
  'Spreadsheets and WhatsApp',
  'Paper timesheets',
  "A system we've outgrown",
  'Another job management app',
  'Nothing formal yet',
] as const

const SUBMIT_KEY = 'pp_interest_submitted_at'
const COOLDOWN_MS = 60_000

const field =
  'w-full rounded-2xl border border-[var(--line)] bg-[var(--soft)] px-3.5 py-3.5 text-base text-[var(--ink)] outline-none focus:border-[var(--blue)] focus:bg-[var(--card)]'
const invalid = 'border-[var(--red)] bg-[var(--red-t)]'
const label = 'mb-1.5 block text-[12.5px] font-bold text-[var(--ink3)]'

export function RegisterInterestForm() {
  const user = useAuthStore((state) => state.user)
  const [sectors, setSectors] = useState<string[]>([])
  const [errors, setErrors] = useState<InterestFieldErrors>({})
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<{ firstName: string; company: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const started = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    void trackEvent('interest_page_viewed', {
      userId: user?.id,
      organizationId: user?.organizationId,
      metadata: {
        source: params.get('utm_source') || 'direct',
        campaign: params.get('utm_campaign') || '',
      },
    })
  }, [user?.id, user?.organizationId])

  function markStarted() {
    if (started.current) return
    started.current = true
    const params = new URLSearchParams(window.location.search)
    void trackEvent('interest_form_started', {
      userId: user?.id,
      organizationId: user?.organizationId,
      metadata: {
        source: params.get('utm_source') || 'direct',
        campaign: params.get('utm_campaign') || '',
      },
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFailed(false)
    const form = event.currentTarget
    const data = new FormData(form)
    const read = (key: string) => String(data.get(key) ?? '')
    const params = new URLSearchParams(window.location.search)
    const built = buildInterestDraft({
      firstName: read('firstName'),
      lastName: read('lastName'),
      company: read('company'),
      email: read('email'),
      phone: read('phone'),
      role: read('role'),
      teamSize: read('teamSize'),
      sectors,
      currentTools: read('current'),
      message: read('message'),
      consent: data.get('consent') === 'on',
      honeypot: read('website'),
      source: params.get('utm_source') || 'direct',
      campaign: params.get('utm_campaign') || '',
      referrer: document.referrer || '',
      pagePath: window.location.pathname,
      userAgent: navigator.userAgent,
    })
    if (!built.ok) {
      setErrors(built.errors)
      const first = (['firstName', 'lastName', 'company', 'email', 'consent'] as const).find((key) => built.errors[key])
      if (first) document.getElementById(first)?.focus()
      return
    }
    setErrors({})
    if (built.silent) {
      setDone({ firstName: read('firstName').trim(), company: read('company').trim() })
      return
    }
    try {
      const last = Number(window.localStorage.getItem(SUBMIT_KEY) || 0)
      if (Date.now() - last < COOLDOWN_MS) {
        setDone({ firstName: built.draft.firstName, company: built.draft.company })
        return
      }
    } catch {
      /* private browsing */
    }
    if (!db) {
      setFailed(true)
      return
    }
    setSending(true)
    try {
      await addDoc(collection(db, 'interestRegistrations'), {
        ...built.draft,
        createdAt: serverTimestamp(),
      })
      try {
        window.localStorage.setItem(SUBMIT_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
      void fetch('/api/interest/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.draft),
      }).catch(() => {})
      void trackEvent('interest_registered', {
        userId: user?.id,
        organizationId: user?.organizationId,
        metadata: { source: built.draft.source, campaign: built.draft.campaign },
      })
      setDone({ firstName: built.draft.firstName, company: built.draft.company })
    } catch (error) {
      console.error('interest registration failed', error)
      void trackEvent('interest_failed', {
        userId: user?.id,
        organizationId: user?.organizationId,
        metadata: { source: built.draft.source, campaign: built.draft.campaign },
      })
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-[28px] border border-[var(--line)] bg-[var(--card)] p-7 shadow-[var(--sh)]" aria-live="polite">
        <div className="py-2 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--proj-t)] text-[var(--proj)]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-[family-name:var(--head)] text-2xl font-extrabold text-[var(--ink)]">You&rsquo;re on the list, {done.firstName}</h2>
          <p className="mx-auto mt-3 max-w-[40ch] text-[15px] text-[var(--ink2)]">
            We&rsquo;ll email you the moment Project Planner opens, and you&rsquo;ll be in the first group through the door.
          </p>
          <div className="mt-5 rounded-[18px] bg-[var(--soft)] p-4 text-left">
            <b className="font-[family-name:var(--head)] text-[14.5px] text-[var(--ink)]">What happens next</b>
            <ol className="mt-2 list-decimal pl-5 text-sm text-[var(--ink2)]">
              <li className="mb-1.5">The odd short update as we finish building — no spam, no newsletter.</li>
              <li className="mb-1.5">An invite before it goes public, with a free trial.</li>
              <li>A setup call so {done.company} starts with its own jobs and people in it.</li>
            </ol>
          </div>
          <p className="mt-4 text-sm text-[var(--ink2)]">
            Can&rsquo;t wait? Email{' '}
            <a href="mailto:support@projectplanner.us" className="font-semibold text-[var(--blue)]">
              support@projectplanner.us
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="form" className="rounded-[28px] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[var(--sh)] sm:p-7">
      <h2 className="font-[family-name:var(--head)] text-[22px] font-extrabold text-[var(--ink)]">Register your interest</h2>
      <p className="mt-1.5 text-[14.5px] text-[var(--ink2)]">
        Two minutes. We&rsquo;ll let you know the moment it opens, and early registrations get first access and a free trial.
      </p>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-5" onFocus={markStarted}>
        <div className="grid grid-cols-2 gap-3">
          <Field id="firstName" label="First name" required autoComplete="given-name" error={errors.firstName} className="col-span-2 sm:col-span-1" />
          <Field id="lastName" label="Last name" required autoComplete="family-name" error={errors.lastName} className="col-span-2 sm:col-span-1" />
          <Field id="company" label="Company" required autoComplete="organization" error={errors.company} className="col-span-2" />
          <Field id="email" label="Work email" required type="email" autoComplete="email" error={errors.email} className="col-span-2 sm:col-span-1" />
          <Field id="phone" label="Phone" type="tel" autoComplete="tel" className="col-span-2 sm:col-span-1" />
          <div className="col-span-2 sm:col-span-1">
            <label className={label} htmlFor="role">Your role</label>
            <select id="role" name="role" className={field} defaultValue="">
              <option value="">Select…</option>
              {ROLES.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={label} htmlFor="teamSize">How many on the tools?</label>
            <select id="teamSize" name="teamSize" className={field} defaultValue="">
              <option value="">Select…</option>
              {TEAM_SIZES.map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <span id="sectorsLabel" className={label}>What do you mostly work on?</span>
            <div role="group" aria-labelledby="sectorsLabel" className="flex flex-wrap gap-2">
              {SECTORS.map((sector) => {
                const on = sectors.includes(sector)
                return (
                  <button
                    key={sector}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSectors((current) => (current.includes(sector) ? current.filter((item) => item !== sector) : [...current, sector]))}
                    className={`rounded-full border px-3.5 py-2.5 text-sm font-semibold ${
                      on ? 'border-[var(--blue)] bg-[var(--blue)] text-white' : 'border-[var(--line)] bg-[var(--soft)] text-[var(--ink)]'
                    }`}
                  >
                    {sector}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="current">What are you using now?</label>
            <select id="current" name="current" className={field} defaultValue="">
              <option value="">Select…</option>
              {CURRENT_TOOLS.map((tool) => (
                <option key={tool}>{tool}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="message">What would you most want it to fix?</label>
            <textarea
              id="message"
              name="message"
              rows={3}
              maxLength={2000}
              placeholder="e.g. we lose most money on variations and chasing timesheets"
              className={`${field} min-h-[92px] resize-y leading-relaxed`}
            />
          </div>
        </div>
        <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="website">Leave this empty</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--soft)] p-3.5">
          <input
            type="checkbox"
            id="consent"
            name="consent"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'err-consent' : undefined}
            className="mt-0.5 h-[22px] w-[22px] shrink-0 accent-[var(--blue)]"
          />
          <label htmlFor="consent" className="text-[13px] font-normal leading-relaxed text-[var(--ink2)]">
            I&rsquo;m happy for Projectplanner Systems Ltd to contact me about Project Planner. We&rsquo;ll never sell your details, and you can ask us to delete them at any time.{' '}
            <a href="/privacy" className="font-semibold text-[var(--blue)]">
              Privacy policy
            </a>
            .
          </label>
        </div>
        {errors.consent ? (
          <p id="err-consent" className="mt-1.5 text-[12.5px] font-semibold text-[var(--red)]">
            {errors.consent}
          </p>
        ) : null}
        {failed ? (
          <p role="alert" className="mt-3 rounded-2xl bg-[var(--red-t)] px-3.5 py-3 text-[13.5px] text-[var(--ink2)]">
            <b className="text-[var(--red)]">That didn&rsquo;t send.</b> Please try again, or email{' '}
            <a href="mailto:support@projectplanner.us" className="font-semibold text-[var(--blue)]">
              support@projectplanner.us
            </a>{' '}
            and we&rsquo;ll pick it up from there.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={sending}
          className="mt-4 w-full rounded-[17px] bg-[var(--blue)] py-4 text-[17px] font-bold text-white shadow-lg disabled:opacity-55 disabled:shadow-none"
        >
          {sending ? 'Sending…' : 'Register my interest'}
        </button>
        <p className="mt-3 text-center text-[12.5px] leading-relaxed text-[var(--ink3)]">
          No card, no commitment. We&rsquo;ll only email you about Project Planner.
        </p>
      </form>
    </div>
  )
}

function Field({
  id,
  label: text,
  required,
  type = 'text',
  autoComplete,
  error,
  className,
}: {
  id: string
  label: string
  required?: boolean
  type?: string
  autoComplete?: string
  error?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className={label} htmlFor={id}>
        {text} {required ? <span className="text-[var(--red)]">*</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `err-${id}` : undefined}
        className={`${field} ${error ? invalid : ''}`}
      />
      {error ? (
        <p id={`err-${id}`} className="mt-1.5 text-[12.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
