'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import type { SubscriptionPlanKey } from '@/lib/stripe/plans'
import { PLAN_KEYS, getSubscriptionPlanDisplayOptions } from '@/lib/stripe/plans'
import { MARKETING_PLANS } from '@/lib/marketing/content'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PlanCards } from '@/components/marketing/PlanCards'
import { MktIcon } from '@/components/marketing/icons'
import { getFirebaseConfigError } from '@/lib/firebase/env'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import { reloadOnceOnStaleChunk } from '@/lib/client/chunkLoadError'
import { withTimeout } from '@/lib/client/withTimeout'
import { formatSetupError } from '@/lib/orgSetup/formatSetupError'
import { createPendingOrganization } from '@/lib/orgSetup/createOrganization'
import { activateOrganizationSubscription } from '@/lib/orgSetup/activateSubscription'
import { switchActiveOrganization } from '@/lib/orgMembership/membershipService'
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

const FEATURE_RAIL = [
  'Working hours & overtime',
  'Annual leave & bank holidays',
  'Schedule options',
  'Payment runs & timesheets',
  'Warnings',
  'Material order cut-off',
]

const TEAM_RAIL = [
  'First manager',
  'First operative',
  'First project',
  'Client details',
  'Sub contractor',
  'Wholesaler',
  'Qualification',
  'Job type',
  'Summary',
]

const IS_PROD = process.env.NODE_ENV === 'production'

export function OrgSetupWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [paymentCancelled, setPaymentCancelled] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [farthestIndex, setFarthestIndex] = useState(0)

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
    const plan = searchParams.get('plan')
    if (plan && PLAN_KEYS.includes(plan as SubscriptionPlanKey)) {
      setPlanKey(plan as SubscriptionPlanKey)
    }
    if (searchParams.get('cancelled') === '1') {
      setPaymentCancelled(true)
      setStep('review')
    }
  }, [draftReady, searchParams])

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
    const idx = STEPS.findIndex((row) => row.id === next)
    setFarthestIndex((current) => Math.max(current, idx))
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
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.'
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
          if (record.isAdditionalOrganization) {
            await withTimeout(
              switchActiveOrganization(record.userId, record.organizationId),
              8000,
              'Organisation is ready. Open Switch organisation to move into it.'
            )
          }
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

  const currentIndex = STEPS.findIndex((row) => row.id === step)
  const progress = Math.round(((currentIndex + 1) / STEPS.length) * 100)
  const marketingPlan = MARKETING_PLANS.find((plan) => plan.key === planKey)
  const displayPrice =
    selectedPlan?.priceLabel && selectedPlan.priceLabel !== '—'
      ? selectedPlan.priceLabel
      : marketingPlan
        ? `£${marketingPlan.price}`
        : selectedPlan?.priceLabel || '—'
  const settingsSkipped =
    !orgSetupSettings.identity.officeAddress.addressLine1 && !orgSetupSettings.identity.officeAddress.town

  const stepTitle: Record<WizardStep, string> = {
    account: 'Create your admin account',
    organization: 'Name your organisation',
    explore: "What's next",
    'org-details': 'Organisation details',
    'org-features': 'Features & functions',
    guided: 'Team & data',
    plan: 'Choose your plan',
    review: 'Review & pay',
  }

  function jumpTo(id: WizardStep) {
    if (submitting) return
    const idx = STEPS.findIndex((row) => row.id === id)
    if (idx <= Math.max(currentIndex, farthestIndex)) goToStep(id)
  }

  return (
    <MarketingShell>
      <section className="s" style={{ paddingTop: 36 }}>
        <div className="wrap" ref={wizardTopRef}>
          <div className="row wr" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800 }}>
                {creatingAdditionalOrg ? 'Set up another organisation' : 'Set up your organisation'}
              </h1>
              <p className="muted" style={{ marginTop: 6 }}>
                {creatingAdditionalOrg
                  ? 'You can belong to as many organisations as you need. This new workspace is billed separately and does not replace your existing ones.'
                  : 'Create your admin account, name your company, then choose a plan. Payment is handled by Stripe on the last step.'}
              </p>
            </div>
            {creatingAdditionalOrg ? (
              <Link href="/dashboard/change-organisation" className="btn ghost">
                Back to organisations
              </Link>
            ) : (
              <Link href="/login" className="btn ghost">
                Already have an account? Sign in
              </Link>
            )}
          </div>

          <div className="wz">
            <aside className="card wz-rail">
              <div className="muted small" style={{ fontWeight: 800 }}>
                Progress
              </div>
              <div className="prog">
                <i style={{ width: `${progress}%` }} />
              </div>
              <div className="muted xs" style={{ marginBottom: 10 }}>
                {progress}% complete
              </div>
              {STEPS.map((row, index) => {
                const done = index < currentIndex
                const on = row.id === step
                const locked = index > Math.max(currentIndex, farthestIndex)
                return (
                  <div key={row.id}>
                    <button
                      type="button"
                      className={`st${on ? ' on' : ''}${done ? ' done' : ''}`}
                      disabled={locked || submitting}
                      onClick={() => jumpTo(row.id)}
                    >
                      <span className="n">{done ? <MktIcon name="check" size={16} /> : index + 1}</span>
                      {row.label}
                    </button>
                    {row.id === 'org-features' && (step === 'org-features' || done) ? (
                      <div className="subs">
                        {FEATURE_RAIL.map((label, sub) => (
                          <button
                            key={label}
                            type="button"
                            className={`${featuresStepIndex === sub && step === 'org-features' ? 'on' : ''}${sub < featuresStepIndex || done ? ' done' : ''}`}
                            onClick={() => {
                              jumpTo('org-features')
                              setFeaturesStepIndex(sub)
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {row.id === 'guided' && (step === 'guided' || done) ? (
                      <div className="subs">
                        {TEAM_RAIL.map((label, sub) => (
                          <button
                            key={label}
                            type="button"
                            className={`${guidedStepIndex === sub && step === 'guided' ? 'on' : ''}${sub < guidedStepIndex || done ? ' done' : ''}`}
                            onClick={() => {
                              jumpTo('guided')
                              setGuidedStepIndex(sub)
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </aside>

            <div className="card wz-card">
              <h2>{stepTitle[step]}</h2>

              {firebaseConfigError ? (
                <div className="banner" data-hue="warn" style={{ margin: '16px 0' }}>
                  <span className="ico-chip">
                    <MktIcon name="alert" size={18} />
                  </span>
                  <div>
                    <b>Environment setup required</b>
                    <div className="small ink2">{firebaseConfigError}</div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="banner" data-hue="red" style={{ margin: '16px 0' }} role="alert">
                  <span className="ico-chip">
                    <MktIcon name="alert" size={18} />
                  </span>
                  <div className="small">{error}</div>
                </div>
              ) : null}

              {paymentCancelled && step === 'review' ? (
                <div className="banner" data-hue="warn" style={{ margin: '16px 0' }}>
                  <span className="ico-chip">
                    <MktIcon name="alert" size={18} />
                  </span>
                  <div>
                    <b>Payment cancelled.</b>
                    <div className="small ink2">Nothing was charged and your details are still here.</div>
                  </div>
                </div>
              ) : null}

              {submitting && submittingStatus ? (
                <div className="banner" data-hue="blue" style={{ margin: '16px 0' }} aria-live="polite">
                  <span className="ico-chip">
                    <span className="spin" />
                  </span>
                  <div>
                    <b>{submittingStatus}</b>
                    <div className="small ink2">Please keep this tab open.</div>
                  </div>
                </div>
              ) : null}

              {step === 'account' ? (
                <div>
                  <p className="muted" style={{ marginBottom: 26 }}>
                    You&apos;ll be the organisation admin. You can add more admins later.
                  </p>
                  <div className="form">
                    <div className="f">
                      <label>
                        First name <span className="req">*</span>
                      </label>
                      <input className="in" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                    </div>
                    <div className="f">
                      <label>
                        Last name <span className="req">*</span>
                      </label>
                      <input className="in" value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" />
                    </div>
                    <div className="f full">
                      <label>
                        Work email <span className="req">*</span>
                      </label>
                      <input
                        className="in"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={creatingAdditionalOrg}
                        placeholder="you@company.co.uk"
                      />
                    </div>
                    <div className="f full">
                      <label>
                        Mobile number <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
                      </label>
                      <input className="in" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} autoComplete="tel" placeholder="07…" />
                    </div>
                    {!creatingAdditionalOrg ? (
                      <>
                        <div className="f">
                          <label>
                            Password <span className="req">*</span>
                          </label>
                          <div className="pw">
                            <input
                              className="in"
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              autoComplete="new-password"
                            />
                            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>
                              <MktIcon name={showPassword ? 'eyeoff' : 'eye'} size={18} />
                            </button>
                          </div>
                          <span className="help">At least 8 characters</span>
                        </div>
                        <div className="f">
                          <label>
                            Confirm password <span className="req">*</span>
                          </label>
                          <input
                            className="in"
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  {!creatingAdditionalOrg ? (
                    <div
                      className="meter"
                      data-hue={password.length >= 12 ? 'green' : password.length >= 8 ? 'warn' : 'red'}
                      aria-hidden
                    >
                      {[4, 8, 12].map((n) => (
                        <i key={n} className={password.length >= n ? 'on' : ''} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 'organization' ? (
                <div>
                  <p className="muted" style={{ marginBottom: 26 }}>
                    This is how your company appears to your team, on reports and in the app header.
                  </p>
                  <div className="form" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="f">
                      <label>
                        Organisation / company name <span className="req">*</span>
                      </label>
                      <input
                        className="in"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="e.g. Acme Construction Ltd"
                        autoComplete="organization"
                      />
                    </div>
                  </div>
                  <div className="banner" data-hue="blue" style={{ marginTop: 22 }}>
                    <span className="ico-chip">
                      <MktIcon name="rocket" size={18} />
                    </span>
                    <div className="grow">
                      <b>In a hurry?</b>
                      <div className="small ink2">
                        Name, email, password and organisation name are enough. You can add the rest after you are in the
                        app.
                      </div>
                    </div>
                    <button type="button" className="btn sm" onClick={skipToReview}>
                      Skip extra details and go to Activate
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 'explore' ? (
                <SetupExplainer
                  organizationName={organizationName.trim()}
                  firstName={firstName.trim()}
                  onBack={() => goToStep('organization')}
                  onContinue={() => goToStep('org-details')}
                  onSkip={skipToReview}
                />
              ) : null}

              {step === 'org-details' ? (
                <OrganisationDetailsStep
                  organizationName={organizationName.trim()}
                  value={orgSetupSettings.identity}
                  onChange={(identity) => patchOrgSetup({ identity })}
                  onBack={() => goToStep('explore')}
                  onContinue={() => goToStep('org-features')}
                />
              ) : null}

              {step === 'org-features' ? (
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
              ) : null}

              {step === 'guided' ? (
                <GuidedOrgSetup
                  data={guidedData}
                  onChange={setGuidedData}
                  stepIndex={guidedStepIndex}
                  onStepIndexChange={setGuidedStepIndex}
                  organizationName={organizationName.trim()}
                  onExitToExplainer={() => goToStep('org-features')}
                  onComplete={() => goToStep('plan')}
                />
              ) : null}

              {step === 'plan' ? (
                <div>
                  <p className="muted" style={{ marginBottom: 22 }}>
                    One-month free trial on every plan. You can change later from Settings.
                  </p>
                  {!IS_PROD && !loadingPlans && pricingMessage && !pricingLoaded ? (
                    <div className="banner" data-hue="warn" style={{ marginBottom: 16 }}>
                      <span className="ico-chip">
                        <MktIcon name="alert" size={18} />
                      </span>
                      <div className="small">{pricingMessage}</div>
                    </div>
                  ) : null}
                  {loadingPlans ? (
                    <div className="flex justify-center py-10">
                      <span className="spin" style={{ width: 28, height: 28, borderColor: 'var(--line2)', borderTopColor: 'var(--blue)' }} />
                    </div>
                  ) : (
                    <PlanCards
                      plans={MARKETING_PLANS}
                      selectedKey={planKey}
                      onSelect={(key) => setPlanKey(key)}
                      ctaMode="choose"
                    />
                  )}
                </div>
              ) : null}

              {step === 'review' ? (
                <div className="stack">
                  {!creatingAdditionalOrg ? (
                    <div className="card pad" style={{ boxShadow: 'none', background: 'var(--soft)' }}>
                      <p className="small" style={{ fontWeight: 700 }}>
                        Confirm the password for {email || 'this email'} so Activate can sign in to the existing account if
                        one already exists.
                      </p>
                      <div className="form" style={{ marginTop: 14 }}>
                        <div className="f">
                          <label>
                            Password <span className="req">*</span>
                          </label>
                          <input className="in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                        </div>
                        <div className="f">
                          <label>
                            Confirm password <span className="req">*</span>
                          </label>
                          <input className="in" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="card pad" style={{ boxShadow: 'none', background: 'var(--soft)' }}>
                    <h3 style={{ fontSize: 16, marginBottom: 12 }}>Summary</h3>
                    {(
                      [
                        ['Admin', `${firstName} ${surname}`.trim(), 'account'],
                        ['Email', email, 'account'],
                        ['Organisation', organizationName, 'organization'],
                        ['Plan', `${selectedPlan?.name || ''} · ${displayPrice}/month`, 'plan'],
                      ] as const
                    ).map(([label, value, target]) => (
                      <div key={label} className="sumrow">
                        <div className="grow">
                          <div className="muted small" style={{ fontWeight: 700 }}>
                            {label}
                          </div>
                          <b>{value || '—'}</b>
                        </div>
                        <button type="button" className="btn xs" onClick={() => goToStep(target)} disabled={submitting}>
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="banner" data-hue={settingsSkipped ? 'lib' : 'green'}>
                    <span className="ico-chip">
                      <MktIcon name={settingsSkipped ? 'settings' : 'check'} size={18} />
                    </span>
                    <div className="grow">
                      <b>{settingsSkipped ? 'Skipped — defaults applied' : 'Organisation settings configured'}</b>
                      <div className="small ink2">
                        {settingsSkipped
                          ? 'You can add office, hours, leave and pay runs later in Settings.'
                          : `${orgSetupSettings.identity.countryLabel} · ${orgSetupSettings.identity.currency} · ${orgSetupSettings.features.payrollTimePolicy.standardDayStart}–${orgSetupSettings.features.payrollTimePolicy.standardDayEnd}`}
                      </div>
                      <div className="muted xs" style={{ marginTop: 6 }}>
                        All settings sync to your organisation in Settings — no need to re-enter after sign-in.
                      </div>
                    </div>
                  </div>

                  <div className="card pad" style={{ boxShadow: 'none', background: 'var(--soft)' }}>
                    <h3 style={{ fontSize: 16, marginBottom: 8 }}>Team &amp; data you set up</h3>
                    <div className="small ink2">
                      Project: {guidedData.project.siteName || '—'} · Client:{' '}
                      {guidedData.client.name || guidedData.project.clientName || '—'} · Job type:{' '}
                      {guidedData.jobType.name || guidedData.project.jobType || '—'}
                    </div>
                  </div>

                  {stripeConfigured ? (
                    <div className="banner" data-hue="blue">
                      <span className="ico-chip">
                        <MktIcon name="lock" size={18} />
                      </span>
                      <div className="small ink2">
                        {creatingAdditionalOrg
                          ? "You'll be redirected to Stripe to enter payment details securely. After payment you'll stay signed in and can switch to this organisation from Change organisation."
                          : "You'll be redirected to Stripe to enter payment details securely. After payment we email a confirmation link — click it, then sign in and accept the customer terms before entering the app."}
                      </div>
                    </div>
                  ) : !IS_PROD ? (
                    <div className="banner" data-hue="warn">
                      <span className="ico-chip">
                        <MktIcon name="alert" size={18} />
                      </span>
                      <div className="small ink2">
                        Stripe is not configured in this environment. Use “Activate without payment (testing)” below.
                      </div>
                    </div>
                  ) : (
                    <div className="banner" data-hue="blue">
                      <span className="ico-chip">
                        <MktIcon name="lock" size={18} />
                      </span>
                      <div className="small ink2">
                        Continue to Stripe to finish setting up your organisation.
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {showGenericNav ? (
                <div className="wz-foot">
                  {step !== 'account' && !(creatingAdditionalOrg && step === 'organization') ? (
                    <button type="button" className="btn" onClick={goBack} disabled={submitting}>
                      Back
                    </button>
                  ) : (
                    <Link href="/" className="btn ghost">
                      Back
                    </Link>
                  )}
                  {step !== 'account' && step !== 'review' ? (
                    <button type="button" className="btn ghost" onClick={skipToReview} disabled={submitting}>
                      Skip extra setup and activate
                    </button>
                  ) : null}
                  <span className="grow" />
                  {step !== 'review' ? (
                    <button type="button" className="btn primary" onClick={goNext}>
                      Continue
                    </button>
                  ) : (
                    <>
                      {!IS_PROD ? (
                        <button
                          type="button"
                          className="btn tint"
                          data-hue="green"
                          onClick={() => void handleTestActivation()}
                          disabled={submitting}
                        >
                          {submitting ? 'Activating…' : 'Activate without payment'}
                          <span className="pill" data-hue="warn" style={{ height: 22, fontSize: 11 }}>
                            Dev only
                          </span>
                        </button>
                      ) : null}
                      {(stripeConfigured || IS_PROD) ? (
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => void handleCheckout()}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <>
                              <span className="spin" /> Preparing checkout…
                            </>
                          ) : (
                            'Continue to Stripe payment'
                          )}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              <p className="muted xs" style={{ marginTop: 18, textAlign: 'center' }}>
                Prefer mobile? You can still use the iOS and Android apps after setup — we recommend creating your
                organisation here on a computer first.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
