'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FormInput, FormLabel } from '@/components/forms/FormShell'
import { createPendingOrganization } from '@/lib/orgSetup/createOrganization'
import type { SubscriptionPlanKey } from '@/lib/stripe/plans'

type WizardStep = 'account' | 'organization' | 'plan' | 'review'

type PlanOption = {
  key: SubscriptionPlanKey
  name: string
  description: string
  priceLabel: string
  interval: 'month' | 'year'
  features: string[]
  recommended: boolean
  configured: boolean
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'account', label: 'Your account' },
  { id: 'organization', label: 'Organisation' },
  { id: 'plan', label: 'Choose plan' },
  { id: 'review', label: 'Review & pay' },
]

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current)

  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex
        const isCurrent = step.id === current
        return (
          <li
            key={step.id}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isCurrent
                ? 'bg-blue-600 text-white'
                : isComplete
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {index + 1}. {step.label}
          </li>
        )
      })}
    </ol>
  )
}

export function OrgSetupWizard() {
  const [step, setStep] = useState<WizardStep>('account')
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [planKey, setPlanKey] = useState<SubscriptionPlanKey>('professional')
  const [policyAccepted, setPolicyAccepted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadPlans() {
      try {
        const response = await fetch('/api/stripe/plans')
        const data = await response.json()
        if (!cancelled) {
          setPlans(data.plans ?? [])
        }
      } catch {
        if (!cancelled) {
          setError('Could not load subscription plans. Check your Stripe environment variables.')
        }
      } finally {
        if (!cancelled) {
          setLoadingPlans(false)
        }
      }
    }
    void loadPlans()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === planKey),
    [plans, planKey]
  )

  function validateAccountStep(): string | null {
    if (!firstName.trim() || !surname.trim()) return 'Please enter your first and last name.'
    if (!email.trim()) return 'Please enter your email address.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  function validateOrganizationStep(): string | null {
    if (!organizationName.trim()) return 'Please enter your organisation name.'
    return null
  }

  function validatePlanStep(): string | null {
    if (!selectedPlan) return 'Please choose a subscription plan.'
    if (!selectedPlan.configured) {
      return `The ${selectedPlan.name} plan is not configured yet. Add the Stripe price ID to your environment.`
    }
    return null
  }

  function goNext() {
    setError('')
    if (step === 'account') {
      const validationError = validateAccountStep()
      if (validationError) {
        setError(validationError)
        return
      }
      setStep('organization')
      return
    }
    if (step === 'organization') {
      const validationError = validateOrganizationStep()
      if (validationError) {
        setError(validationError)
        return
      }
      setStep('plan')
      return
    }
    if (step === 'plan') {
      const validationError = validatePlanStep()
      if (validationError) {
        setError(validationError)
        return
      }
      setStep('review')
    }
  }

  function goBack() {
    setError('')
    if (step === 'organization') setStep('account')
    if (step === 'plan') setStep('organization')
    if (step === 'review') setStep('plan')
  }

  async function handleCheckout() {
    setError('')
    const accountError = validateAccountStep()
    const orgError = validateOrganizationStep()
    const planError = validatePlanStep()
    if (accountError || orgError || planError) {
      setError(accountError || orgError || planError || 'Please complete all steps.')
      return
    }
    if (!policyAccepted) {
      setError('Please accept the terms and privacy policy to continue.')
      return
    }

    setSubmitting(true)
    try {
      const { userId, organizationId } = await createPendingOrganization({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        surname: surname.trim(),
        organizationName: organizationName.trim(),
        planKey,
        policyAccepted,
      })

      const checkoutResponse = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          organizationId,
          userId,
          email: email.trim(),
        }),
      })

      const checkoutData = await checkoutResponse.json()
      if (!checkoutResponse.ok) {
        throw new Error(checkoutData.error || 'Could not start Stripe checkout')
      }

      window.location.href = checkoutData.url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Setup failed'
      if (message.includes('email-already-in-use')) {
        setError('An account with this email already exists. Sign in instead, or use a different email.')
      } else {
        setError(message)
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] px-5 py-10">
      <div className="mx-auto w-full max-w-[920px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              ← Back to Project Planner
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900">Set up your organisation</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Create your admin account, name your company, and choose a subscription. We recommend completing
              this on desktop — it mirrors the iOS onboarding flow and includes secure Stripe billing.
            </p>
          </div>
          <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            Already have an account? Sign in
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_30px_rgba(15,23,42,0.08)] sm:p-8">
          <StepIndicator current={step} />

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 'account' && (
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div>
                <FormLabel required>First name</FormLabel>
                <FormInput value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div>
                <FormLabel required>Last name</FormLabel>
                <FormInput value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" />
              </div>
              <div className="sm:col-span-2">
                <FormLabel required>Work email</FormLabel>
                <FormInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div>
                <FormLabel required>Password</FormLabel>
                <FormInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <FormLabel required>Confirm password</FormLabel>
                <FormInput
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {step === 'organization' && (
            <div className="mt-8 space-y-5">
              <div>
                <FormLabel required>Organisation / company name</FormLabel>
                <FormInput
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g. Acme Construction Ltd"
                />
              </div>
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                This becomes your workspace name in Project Planner. You can invite managers and operatives after
                setup from the web app or iOS app.
              </p>
            </div>
          )}

          {step === 'plan' && (
            <div className="mt-8">
              {loadingPlans ? (
                <div className="flex justify-center py-10">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {plans.map((plan) => {
                    const selected = plan.key === planKey
                    return (
                      <button
                        key={plan.key}
                        type="button"
                        onClick={() => setPlanKey(plan.key)}
                        className={`rounded-2xl border p-5 text-left transition ${
                          selected
                            ? 'border-blue-600 bg-blue-50 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                          {plan.recommended && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-2xl font-extrabold text-slate-900">
                          {plan.priceLabel}
                          <span className="text-sm font-medium text-slate-500">/{plan.interval}</span>
                        </p>
                        <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                        <ul className="mt-4 space-y-2 text-sm text-slate-700">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex gap-2">
                              <span className="text-emerald-600">✓</span>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {!plan.configured && (
                          <p className="mt-4 text-xs font-medium text-amber-700">
                            Stripe price ID not configured for this tier yet.
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="mt-8 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Summary</h3>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Admin</dt>
                    <dd className="font-semibold text-slate-900">
                      {firstName} {surname}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Email</dt>
                    <dd className="font-semibold text-slate-900">{email}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Organisation</dt>
                    <dd className="font-semibold text-slate-900">{organizationName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Plan</dt>
                    <dd className="font-semibold text-slate-900">
                      {selectedPlan?.name} ({selectedPlan?.priceLabel}/{selectedPlan?.interval})
                    </dd>
                  </div>
                </dl>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(e) => setPolicyAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  I agree to the{' '}
                  <a href="https://projectplanner.us/terms-of-service.html" className="font-semibold text-blue-600 hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="https://projectplanner.us/privacy-policy.html" className="font-semibold text-blue-600 hover:underline">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                You&apos;ll be redirected to Stripe to enter payment details securely. Your organisation is created
                first, then activated once payment succeeds.
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {step !== 'account' && (
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>
            )}

            {step !== 'review' ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={submitting}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Preparing checkout…' : 'Continue to Stripe payment'}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Prefer mobile? You can still use the iOS app after setup — we recommend creating your organisation here on desktop first.
        </p>
      </div>
    </div>
  )
}
