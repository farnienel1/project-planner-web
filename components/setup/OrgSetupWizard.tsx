'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormInput, FormLabel } from '@/components/forms/FormShell'
import { useAuthStore } from '@/lib/stores/authStore'
import type { SubscriptionPlanKey } from '@/lib/stripe/plans'
import { getSubscriptionPlanDisplayOptions } from '@/lib/stripe/plans'
import { getFirebaseConfigError } from '@/lib/firebase/env'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import { reloadOnceOnStaleChunk } from '@/lib/client/chunkLoadError'
import { withTimeout } from '@/lib/client/withTimeout'
import { formatSetupError } from '@/lib/orgSetup/formatSetupError'
import { createPendingOrganization } from '@/lib/orgSetup/createOrganization'
import { activateOrganizationSubscription } from '@/lib/orgSetup/activateSubscription'
import { requestFounderConfirmEmail } from '@/lib/orgSetup/requestFounderConfirmEmail'
import { saveFounderConfirmEmailPayload } from '@/lib/orgSetup/founderConfirmEmail'
import { saveGuidedSetupDraft } from '@/lib/orgSetup/persistGuidedSetup'
import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { SetupExplainer } from '@/components/setup/SetupExplainer'
import { OrganisationDetailsStep } from '@/components/setup/OrganisationDetailsStep'
import { OrganisationFeaturesStep } from '@/components/setup/OrganisationFeaturesStep'
import { GuidedOrgSetup, createEmptyGuidedSetupData, type GuidedSetupData } from '@/components/setup/GuidedOrgSetup'
import {
  createDefaultOrgSetupSettings,
  type OrgSetupSettings,
} from '@/lib/orgSetup/orgSetupSettings'

type WizardStep =
  | 'account'
  | 'organization'
  | 'explore'
  | 'org-details'
  | 'org-features'
  | 'guided'
  | 'plan'
  | 'review'

type PlanOption = ReturnType<typeof getSubscriptionPlanDisplayOptions>[number]

const ACTIVATION_OVERALL_MS = 15000
const ACTIVATION_TIMEOUT_MESSAGE =
  'Activation is taking too long. Your details are saved on this tab — click Activate again. If it still sticks, open /setup in a new private window.'
const WIZARD_DRAFT_KEY = 'pp.setupWizard.v1'

type WizardDraft = {
  step?: WizardStep
  firstName?: string
  surname?: string
  mobileNumber?: string
  email?: string
  organizationName?: string
  planKey?: SubscriptionPlanKey
}

function readWizardDraft(): WizardDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(WIZARD_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WizardDraft
  } catch {
    return null
  }
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'account', label: 'Your Account' },
  { id: 'organization', label: 'Organisation' },
  { id: 'explore', label: "What's Next" },
  { id: 'org-details', label: 'Organisation Details' },
  { id: 'org-features', label: 'Features & Functions' },
  { id: 'guided', label: 'Team & Data' },
  { id: 'plan', label: 'Choose Plan' },
  { id: 'review', label: 'Review & Pay' },
]

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current)

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max flex-wrap gap-2">
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex
        const isCurrent = step.id === current
        return (
          <li
            key={step.id}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold sm:text-sm ${
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
    </div>
  )
}

export function OrgSetupWizard() {
  const router = useRouter()
  const { user: signedInUser, firebaseUser } = useAuthStore()
  const creatingAdditionalOrg = Boolean(firebaseUser)
  const wizardTopRef = useRef<HTMLDivElement>(null)
  const activationRunRef = useRef(0)
  const [step, setStep] = useState<WizardStep>('account')
  const [plans, setPlans] = useState<PlanOption[]>(() => getSubscriptionPlanDisplayOptions(false))
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [pricingLoaded, setPricingLoaded] = useState(false)
  const [pricingMessage, setPricingMessage] = useState<string | null>(null)
  const firebaseConfigError = getFirebaseConfigError()
  const [submitting, setSubmitting] = useState(false)
  const [submittingStatus, setSubmittingStatus] = useState('')
  const [error, setError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [planKey, setPlanKey] = useState<SubscriptionPlanKey>('professional')

  const [orgSetupSettings, setOrgSetupSettings] = useState<OrgSetupSettings>(createDefaultOrgSetupSettings())
  const [featuresStepIndex, setFeaturesStepIndex] = useState(0)

  // Guided team & data setup — team entities written after activation (see handoff note).
  const [guidedData, setGuidedData] = useState<GuidedSetupData>(createEmptyGuidedSetupData())
  const [guidedStepIndex, setGuidedStepIndex] = useState(0)
  const [draftReady, setDraftReady] = useState(false)

  useEffect(() => {
    const draft = readWizardDraft()
    if (draft) {
      if (draft.firstName) setFirstName(draft.firstName)
      if (draft.surname) setSurname(draft.surname)
      if (draft.mobileNumber) setMobileNumber(draft.mobileNumber)
      if (draft.email) setEmail(draft.email)
      if (draft.organizationName) setOrganizationName(draft.organizationName)
      if (draft.planKey) setPlanKey(draft.planKey)
      if (draft.step && draft.step !== 'account') setStep(draft.step)
    }
    setDraftReady(true)
  }, [])

  useEffect(() => {
    if (!draftReady) return
    try {
      const draft: WizardDraft = {
        step,
        firstName,
        surname,
        mobileNumber,
        email,
        organizationName,
        planKey,
      }
      window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // private mode
    }
  }, [draftReady, step, firstName, surname, mobileNumber, email, organizationName, planKey])

  useEffect(() => {
    let cancelled = false
    async function loadPlans() {
      setLoadingPlans(true)
      try {
        const response = await fetch('/api/stripe/plans')
        const data = (await response.json()) as {
          plans?: PlanOption[]
          error?: string
          pricingLoaded?: boolean
          pricingError?: string
        }
        if (!cancelled) {
          if (response.ok && Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans)
            setPricingLoaded(Boolean(data.pricingLoaded))
            setPricingMessage(
              data.pricingLoaded
                ? null
                : data.pricingError ||
                    'Live Stripe prices not loaded — add STRIPE_SECRET_KEY to .env.local and restart npm run dev.'
            )
          } else {
            setPlans(getSubscriptionPlanDisplayOptions(false))
            setPricingLoaded(false)
            setPricingMessage(
              data.pricingError ||
                data.error ||
                'Could not load live Stripe prices. Showing default plans.'
            )
          }
        }
      } catch {
        if (!cancelled) {
          setPlans(getSubscriptionPlanDisplayOptions(false))
          setPricingLoaded(false)
          setPricingMessage(
            'Could not reach the plans API. Check that npm run dev is running from the project folder.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingPlans(false)
        }
      }
    }
    if (step === 'plan' || step === 'review') {
      void loadPlans()
    }
    return () => {
      cancelled = true
    }
  }, [step])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === planKey),
    [plans, planKey]
  )

  const stripeConfigured = useMemo(
    () => plans.some((plan) => plan.configured),
    [plans]
  )

  function goToStep(next: WizardStep) {
    setStep(next)
    window.requestAnimationFrame(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  useEffect(() => {
    wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  useEffect(() => {
    if (!firebaseUser) return
    if (signedInUser) {
      setFirstName((value) => value || signedInUser.firstName)
      setSurname((value) => value || signedInUser.surname)
      setEmail(signedInUser.email || firebaseUser.email || '')
      setMobileNumber((value) => value || signedInUser.mobileNumber || '')
      if (signedInUser.firstName.trim() && signedInUser.surname.trim()) {
        setStep((current) => (current === 'account' ? 'organization' : current))
      }
      return
    }
    if (firebaseUser.email) setEmail(firebaseUser.email)
  }, [firebaseUser, signedInUser])

  function validateAccountStep(): string | null {
    if (!firstName.trim() || !surname.trim()) return 'Please enter your first and last name.'
    if (!email.trim()) return 'Please enter your email address.'
    if (creatingAdditionalOrg) return null
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  function validateOrganizationStep(): string | null {
    if (!organizationName.trim()) return 'Please enter your organisation name.'
    return null
  }

  function validatePlanStep(requireStripe = false): string | null {
    if (!selectedPlan) return 'Please choose a subscription plan.'
    if (requireStripe && !selectedPlan.configured) {
      return 'Stripe is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID to your .env.local file, then restart the dev server.'
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
      goToStep('organization')
      return
    }
    if (step === 'organization') {
      const validationError = validateOrganizationStep()
      if (validationError) {
        setError(validationError)
        return
      }
      goToStep('explore')
      return
    }
    if (step === 'plan') {
      const validationError = validatePlanStep(false)
      if (validationError) {
        setError(validationError)
        return
      }
      goToStep('review')
    }
  }

  function goBack() {
    setError('')
    if (step === 'organization') {
      if (!creatingAdditionalOrg) goToStep('account')
      return
    }
    if (step === 'plan') {
      goToStep(organizationName.trim() ? 'organization' : 'guided')
    }
    if (step === 'review') goToStep('plan')
  }

  function patchOrgSetup(patch: Partial<OrgSetupSettings>) {
    setOrgSetupSettings((prev) => ({ ...prev, ...patch }))
  }

  function skipToReview() {
    setError('')
    const accountError = validateAccountStep()
    if (accountError) {
      setError(accountError)
      goToStep('account')
      return
    }
    const orgError = validateOrganizationStep()
    if (orgError) {
      setError(orgError)
      goToStep('organization')
      return
    }
    goToStep('review')
  }

  async function createOrganizationRecord(options?: { skipOptionalAssets?: boolean }) {
    const auth = getFirebaseAuth()
    const signedIn = Boolean(auth.currentUser)
    return createPendingOrganization({
      email: (auth.currentUser?.email || firebaseUser?.email || email).trim(),
      ...(signedIn ? {} : { password }),
      firstName: firstName.trim(),
      surname: surname.trim(),
      mobileNumber: mobileNumber.trim(),
      organizationName: organizationName.trim(),
      planKey,
      orgSetupSettings,
      skipOptionalAssets: options?.skipOptionalAssets === true,
    })
  }

  /** Test path: create org + activate without Stripe. Skip guided writes so this is fast. */
  async function handleTestActivation() {
    setError('')
    const accountError = validateAccountStep()
    const orgError = validateOrganizationStep()
    const planError = validatePlanStep(false)
    if (accountError || orgError || planError) {
      setError(accountError || orgError || planError || 'Please complete all steps.')
      return
    }

    let didNavigate = false
    const runId = activationRunRef.current + 1
    activationRunRef.current = runId
    const watchdog = window.setTimeout(() => {
      if (activationRunRef.current !== runId) return
      setError(ACTIVATION_TIMEOUT_MESSAGE)
      setSubmitting(false)
      setSubmittingStatus('')
    }, ACTIVATION_OVERALL_MS)

    setSubmitting(true)
    setSubmittingStatus('Creating your organisation…')
    try {
      const created = await withTimeout(
        (async () => {
          const record = await createOrganizationRecord({ skipOptionalAssets: true })
          setSubmittingStatus('Activating…')
          await withTimeout(
            activateOrganizationSubscription(record.organizationId, {
              status: 'active',
              planKey,
              activatedAt: new Date(),
            }),
            6000,
            'Could not finish activating. Click Activate again — your details are still on this page.'
          )
          return record
        })(),
        ACTIVATION_OVERALL_MS,
        ACTIVATION_TIMEOUT_MESSAGE
      )
      window.clearTimeout(watchdog)

      if (!created.needsEmailConfirmation) {
        didNavigate = true
        window.location.href = '/dashboard'
        return
      }

      const to = (
        getFirebaseAuth().currentUser?.email ||
        firebaseUser?.email ||
        email
      )
        .trim()
        .toLowerCase()
      const payload = {
        confirmationToken: created.confirmationToken,
        organizationName: organizationName.trim(),
        firstName: firstName.trim() || 'there',
        to,
      }
      setSubmittingStatus('Sending confirmation email…')
      try {
        await requestFounderConfirmEmail(payload)
      } catch {
        try {
          await requestFounderConfirmEmail(payload)
        } catch (emailError) {
          saveFounderConfirmEmailPayload({
            ...payload,
            lastError: formatSetupError(emailError),
          })
        }
      }
      didNavigate = true
      router.push('/setup/check-email')
    } catch (err) {
      if (reloadOnceOnStaleChunk(err)) return
      setError(formatSetupError(err))
    } finally {
      window.clearTimeout(watchdog)
      if (activationRunRef.current === runId && !didNavigate) {
        setSubmitting(false)
        setSubmittingStatus('')
      }
    }
  }

  async function handleCheckout() {
    setError('')
    const accountError = validateAccountStep()
    const orgError = validateOrganizationStep()
    const planError = validatePlanStep(true)
    if (accountError || orgError || planError) {
      setError(accountError || orgError || planError || 'Please complete all steps.')
      return
    }

    setSubmitting(true)
    setSubmittingStatus('Creating your organisation…')
    try {
      await withTimeout(
        (async () => {
          const { userId, organizationId } = await createOrganizationRecord()

          setSubmittingStatus('Saving setup draft…')
          try {
            await withTimeout(saveGuidedSetupDraft(organizationId, guidedData), 8000, 'draft')
          } catch {
            // Checkout can still proceed without the draft.
          }

          setSubmittingStatus('Opening Stripe…')
          const checkoutResponse = await fetch('/api/stripe/create-checkout-session', {
            method: 'POST',
            headers: await jsonAuthHeaders(),
            body: JSON.stringify({
              planKey,
              organizationId,
              userId,
              email: (firebaseUser?.email || email).trim().toLowerCase(),
            }),
          })

          const checkoutData = await checkoutResponse.json()
          if (!checkoutResponse.ok) {
            throw new Error(checkoutData.error || 'Could not start Stripe checkout')
          }

          window.location.href = checkoutData.url
        })(),
        ACTIVATION_OVERALL_MS,
        'Opening checkout is taking too long. Refresh this page, then try again.'
      )
    } catch (err) {
      if (reloadOnceOnStaleChunk(err)) return
      setError(formatSetupError(err))
      setSubmitting(false)
      setSubmittingStatus('')
    }
  }

  const showGenericNav =
    step !== 'explore' &&
    step !== 'org-details' &&
    step !== 'org-features' &&
    step !== 'guided'

  return (
    <div className="min-h-screen bg-[#f4f6f9] px-5 py-10">
      <div ref={wizardTopRef} className="mx-auto w-full max-w-[920px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              ← Back to Project Planner
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
              {creatingAdditionalOrg ? 'Set up another organisation' : 'Set up your organisation'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {creatingAdditionalOrg ? (
                'You can belong to as many organisations as you need. This new workspace is billed separately and does not replace your existing ones.'
              ) : (
                <>
                  Create your admin account, name your company, and walk through guided team &amp; data setup before
                  choosing a subscription. For now, setup runs <strong>before</strong> payment so you can test the
                  full flow without Stripe.
                </>
              )}
            </p>
          </div>
          {creatingAdditionalOrg ? (
            <Link
              href="/dashboard/change-organisation"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Back to organisations
            </Link>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              Already have an account? Sign in
            </Link>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_30px_rgba(15,23,42,0.08)] sm:p-8">
          <StepIndicator current={step} />

          {firebaseConfigError && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Environment setup required</p>
              <p className="mt-1">{firebaseConfigError}</p>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {step !== 'account' && step !== 'review' && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <button
                type="button"
                onClick={skipToReview}
                className="text-sm font-semibold text-emerald-900 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-700"
              >
                Skip extra details and go to Activate
              </button>
              <p className="mt-1 text-xs text-emerald-800">
                Name, email, password and organisation name are enough. You can add the rest after you are in the app.
              </p>
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
                <FormInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={creatingAdditionalOrg}
                />
              </div>
              <div className="sm:col-span-2">
                <FormLabel>Mobile number</FormLabel>
                <FormInput value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} autoComplete="tel" />
              </div>
              {!creatingAdditionalOrg && (
                <>
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
                </>
              )}
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
                This becomes your workspace name in Project Planner. Next, we&apos;ll show you what comes next, then
                get your first team members and project set up together.
              </p>
            </div>
          )}

          {step === 'explore' && (
            <div className="mt-8">
              <SetupExplainer
                organizationName={organizationName.trim()}
                firstName={firstName.trim()}
                onBack={() => goToStep('organization')}
                onContinue={() => goToStep('org-details')}
                onSkip={skipToReview}
              />
            </div>
          )}

          {step === 'org-details' && (
            <div className="mt-8">
              <OrganisationDetailsStep
                organizationName={organizationName.trim()}
                value={orgSetupSettings.identity}
                onChange={(identity) => patchOrgSetup({ identity })}
                onBack={() => goToStep('explore')}
                onContinue={() => goToStep('org-features')}
              />
            </div>
          )}

          {step === 'org-features' && (
            <div className="mt-8">
              <OrganisationFeaturesStep
                value={orgSetupSettings.features}
                countryCode={orgSetupSettings.identity.countryCode}
                countryLabel={orgSetupSettings.identity.countryLabel}
                onChange={(features) => patchOrgSetup({ features })}
                onRegionChange={(countryCode, countryLabel) =>
                  patchOrgSetup({
                    identity: { ...orgSetupSettings.identity, countryCode, countryLabel },
                  })
                }
                stepIndex={featuresStepIndex}
                onStepIndexChange={setFeaturesStepIndex}
                onBack={() => goToStep('org-details')}
                onComplete={() => goToStep('guided')}
              />
            </div>
          )}

          {step === 'guided' && (
            <div className="mt-8">
              <GuidedOrgSetup
                data={guidedData}
                onChange={setGuidedData}
                stepIndex={guidedStepIndex}
                onStepIndexChange={setGuidedStepIndex}
                organizationName={organizationName.trim()}
                onExitToExplainer={() => goToStep('org-features')}
                onComplete={() => goToStep('plan')}
              />
            </div>
          )}

          {step === 'plan' && (
            <div className="mt-8">
              {!loadingPlans && pricingMessage && !pricingLoaded && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {pricingMessage}
                </div>
              )}
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
                            Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID to .env.local to enable checkout.
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
              {!creatingAdditionalOrg && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-800">
                    Confirm the password for {email || 'this email'} so Activate can sign in to the existing account if
                    one already exists.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <FormLabel required>Password</FormLabel>
                      <FormInput
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
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
                </div>
              )}
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

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                  Organisation settings configured
                </h3>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-emerald-800/70">Office</dt>
                    <dd className="font-semibold text-emerald-950">
                      {orgSetupSettings.identity.officeAddress.addressLine1},{' '}
                      {orgSetupSettings.identity.officeAddress.town}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-emerald-800/70">Region &amp; currency</dt>
                    <dd className="font-semibold text-emerald-950">
                      {orgSetupSettings.identity.countryLabel} · {orgSetupSettings.identity.currency}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-emerald-800/70">Logo</dt>
                    <dd className="font-semibold text-emerald-950">
                      {orgSetupSettings.identity.logoFile ? 'Ready to upload' : 'Not added'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-emerald-800/70">Working hours</dt>
                    <dd className="font-semibold text-emerald-950">
                      {orgSetupSettings.features.payrollTimePolicy.standardDayStart}–
                      {orgSetupSettings.features.payrollTimePolicy.standardDayEnd}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-emerald-800">
                  All settings sync to your organisation in Settings — no need to re-enter after sign-in.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Team &amp; data you set up</h3>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Team</dt>
                    <dd className="font-semibold text-slate-900">Add managers &amp; operatives after sign-in</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Project</dt>
                    <dd className="font-semibold text-slate-900">{guidedData.project.siteName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Client</dt>
                    <dd className="font-semibold text-slate-900">{guidedData.client.name || guidedData.project.clientName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Job type</dt>
                    <dd className="font-semibold text-slate-900">{guidedData.jobType.name || guidedData.project.jobType || '—'}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">
                  Plus a sub contractor, wholesaler and qualification — all ready to activate the moment payment
                  succeeds.
                </p>
              </div>

              {stripeConfigured ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  {creatingAdditionalOrg
                    ? "You'll be redirected to Stripe to enter payment details securely. After payment you'll stay signed in and can switch to this organisation from Change organisation."
                    : "You'll be redirected to Stripe to enter payment details securely. After payment we email a confirmation link — click it, then sign in and accept the customer terms before entering the app."}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {creatingAdditionalOrg
                    ? 'Stripe is not configured in this environment. Use “Activate without payment (testing)” below to open the new organisation without leaving your account.'
                    : 'Stripe is not configured in this environment. Use “Activate without payment (testing)” below, then confirm the email we send before signing in.'}
                </div>
              )}
            </div>
          )}

          {showGenericNav && (
            <div className="mt-8 flex flex-wrap gap-3">
              {step !== 'account' && !(creatingAdditionalOrg && step === 'organization') && (
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
                <>
                  <button
                    type="button"
                    onClick={() => void handleTestActivation()}
                    disabled={submitting}
                    className="rounded-xl border border-emerald-600 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Activating…' : 'Activate without payment (testing)'}
                  </button>
                  {stripeConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleCheckout()}
                      disabled={submitting}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? 'Preparing checkout…' : 'Continue to Stripe payment'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {submitting && submittingStatus ? (
            <p className="mt-3 text-sm font-medium text-emerald-800">{submittingStatus}</p>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Prefer mobile? You can still use the iOS app after setup — we recommend creating your organisation here on desktop first.
        </p>
      </div>
    </div>
  )
}
