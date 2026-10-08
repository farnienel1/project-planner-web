'use client'

import { create } from 'zustand'
import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { doc, getDoc, onSnapshot, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { withTimeout, withTimeoutFallback, isTimeoutError } from '@/lib/client/withTimeout'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { isFirebaseConfigured } from '@/lib/firebase/env'
import { loadUserDocumentWithRetry } from '@/lib/firebase/loadUserDocument'
import { readOrganizationDocument } from '@/lib/firebase/orgDocumentCache'
import { mergePlaceholderUserDocOntoAuthUidIfNeeded } from '@/lib/firebase/mergePlaceholderUser'
import { parseAppUserDocument } from '@/lib/ios-parity/converters'
import type { User, Organization } from '@/types'
import { parseOrgBilling } from '@/lib/stripe/billing'
import { withSeededNavigationLabels } from '@/lib/navigation/sharedUiLabels'
import { parseTeamOnboarding } from '@/lib/orgSetup/teamOnboarding'
import { topLevelAdminFlagPatch } from '@/lib/orgSetup/repairAdminFlags'
import { ACCOUNT_UNCONFIRMED_MESSAGE } from '@/lib/orgSetup/accountConfirmation'
import { ensurePrimaryOrgMembership, resolveWebSessionOrganization } from '@/lib/orgMembership/membershipService'
import { adoptCurrentOrganization } from '@/lib/canonical'
import {
  applyRememberedWebOrganization,
  clearRememberedOrgDenied,
  organizationIdsMatch,
  provisionalWebOrganizationId,
  readWebActiveOrg,
  rememberedOrgWasDenied,
  sessionUserForOrganizationProbe,
  writeWebActiveOrg,
} from '@/lib/orgMembership/webActiveOrg'
import { sessionUserFromCurrentDocument } from '@/lib/auth/sessionUserFromCurrentDocument'
import {
  completeEmailSignIn,
  SIGN_IN_SLOW_MESSAGE,
} from '@/lib/auth/completeEmailSignIn'
import {
  clearWebIdleActivity,
  isWebIdleExpired,
  markWebIdleExpired,
  noteWebIdleActivity,
  readWebIdleLastActivity,
} from '@/lib/auth/webIdleSession'
import { isPlatformOwnerEmail, isPlatformOwnerSentinelOrg, isPlatformOwnerSession, PLATFORM_OWNER_EMAIL } from '@/lib/platform/owner'
import { platformOwnerProfilePayload, platformOwnerUser } from '@/lib/platform/ownerProfile'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import {
  clearMfaCookiesOnly,
  clearMfaSession,
  grantMfaSkip,
  isMfaGateOpen,
  isMfaRequiredError,
  MfaRequiredError,
  openMfaGate,
  readMfaGate,
  readMfaStatus,
  readSignedOutFlag,
  startEmailMfa,
  writeSignedOutFlag,
} from '@/lib/auth/mfa/mfaClient'
import { postSignOutHref, safePostMfaPath } from '@/lib/auth/mfa/mfaConstants'
import { authLoadRetryDelayMs, isRetryableAuthLoadError, shouldHoldSignedOutCallback } from '@/lib/auth/authBoot'
import { waitForAuthToken } from '@/lib/firebase/waitForAuthToken'

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  organization: Organization | null
  /** The signed-in person's users/{uid} document, as last read. Pages read per-user settings from here instead of re-fetching it. */
  currentUserDocument: Record<string, unknown> | null
  loading: boolean
  error: string | null
  mfaPending: boolean
  mfaVerified: boolean
  mfaStatusKnown: boolean
  mfaNext: string
  setMfaPending: (value: boolean) => void
  markMfaVerified: () => void
  signIn: (email: string, password: string, opts?: { next?: string }) => Promise<void>
  signUp: (email: string, password: string, organizationName: string) => Promise<void>
  signUpOwner: (password: string) => Promise<void>
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>
  signOut: (opts?: { idle?: boolean }) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  checkAuth: () => void
  recordLastSeenIfDue: () => Promise<void>
  ensureSignedInProfile: () => Promise<void>
  reloadSignedInProfile: () => Promise<void>
}

const LAST_SEEN_THROTTLE_MS = 120_000
const PROFILE_LOAD_MS = 20_000
const PROFILE_LOAD_GRACE_MS = 15_000
const PROFILE_STEP_MS = 4000

let lastSeenWriteAt = 0
let inFlightProfile: { uid: string; promise: Promise<void> } | null = null
let signingOut = false
let signingIn = false
let currentUserWatch: (() => void) | null = null
let organizationHydration = 0

/** This navigation asked to open a company. Leave the query in place until that company is open. */
function readExplicitSwitchOrganization(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URL(window.location.href).searchParams.get('switchOrg')?.trim() || null
  } catch {
    return null
  }
}

function commitExplicitSwitchOrganization(organizationId: string) {
  if (typeof window === 'undefined' || !organizationId) return
  try {
    const url = new URL(window.location.href)
    const current = url.searchParams.get('switchOrg')?.trim() || ''
    if (!current || !organizationIdsMatch(current, organizationId)) return
    url.searchParams.delete('switchOrg')
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, '', next)
  } catch {
    /* Keep ?switchOrg= so a retry still opens this company. */
  }
}

function webOrganizationIdFor(userId: string, currentOrganizationId: string): string {
  const remembered = readWebActiveOrg(userId)
  return applyRememberedWebOrganization({
    userOrganizationId: currentOrganizationId,
    rememberedOrganizationId: remembered,
    explicitOrganizationId: readExplicitSwitchOrganization(),
    rememberedProbe: remembered && rememberedOrgWasDenied(userId, remembered) ? 'denied' : 'unknown',
  })
}

function withWebOrganization(user: User): User {
  const organizationId = webOrganizationIdFor(user.id, user.organizationId)
  if (!organizationId || organizationIdsMatch(user.organizationId, organizationId)) return user
  return { ...user, organizationId }
}

function stubOrganization(organizationId: string): Organization {
  const now = new Date()
  return {
    id: organizationId,
    name: '',
    members: {},
    settings: {},
    createdAt: now,
    updatedAt: now,
  }
}

function stopCurrentUserWatch() {
  currentUserWatch?.()
  currentUserWatch = null
}

/** iOS observeCurrentUserDocument — permission edits apply without a full reload. */
function watchCurrentUserDocument(uid: string) {
  stopCurrentUserWatch()
  if (typeof window === 'undefined' || !uid) return
  const db = getFirebaseDb()
  currentUserWatch = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (signingOut || !snap.exists()) return
      let authUser: FirebaseUser | null = null
      try {
        authUser = getFirebaseAuth().currentUser
      } catch {
        return
      }
      if (!authUser || authUser.uid !== uid) return
      const state = useAuthStore.getState()
      if (!state.user || state.user.id !== uid || state.mfaPending) return
      const currentUserDocument = snap.data() as Record<string, unknown>
      if (state.currentUserDocument !== currentUserDocument) useAuthStore.setState({ currentUserDocument })
      const next = sessionUserFromCurrentDocument(state.user, currentUserDocument)
      const base = next ?? state.user
      const fixed = withWebOrganization(base)
      if (!next && fixed === base) return
      const organization =
        state.organization && organizationIdsMatch(state.organization.id, fixed.organizationId)
          ? state.organization
          : fixed.organizationId
            ? stubOrganization(fixed.organizationId)
            : state.organization
      useAuthStore.setState({ user: fixed, organization })
    },
    (error) => {
      console.warn('Current user listener skipped:', error)
    }
  )
}
let mfaStatusFailures = 0
const PROFILE_ATTEMPTS = 4

function redirectAfterSignOut() {
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  if (
    path === '/login' ||
    path === '/developer-login' ||
    path.startsWith('/auth/') ||
    path.startsWith('/setup') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/confirm-account')
  ) {
    return
  }
  window.location.replace(postSignOutHref(path))
}

let lastVerifiedAt = 0

function recentlyMarkedVerified(): boolean {
  return Date.now() - lastVerifiedAt < 20_000
}

async function syncMfaStatusFromCookie() {
  const state = useAuthStore.getState()
  if (state.mfaPending || readMfaGate()) return
  let status: { pending: boolean; verified: boolean; next?: string } = {
    pending: false,
    verified: false,
    next: '',
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      status = await withTimeout(readMfaStatus(), 8000, 'mfa-status')
      mfaStatusFailures = 0
      break
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, authLoadRetryDelayMs(attempt)))
        continue
      }
      mfaStatusFailures += 1
      if (mfaStatusFailures < 4 && typeof window !== 'undefined') {
        window.setTimeout(() => {
          void syncMfaStatusFromCookie()
        }, 1000)
        return
      }
      if (recentlyMarkedVerified()) {
        useAuthStore.setState({ mfaVerified: true, mfaStatusKnown: true, mfaPending: false })
      } else {
        useAuthStore.setState({ mfaStatusKnown: true, mfaVerified: false, mfaPending: false })
      }
      return
    }
  }
  if (useAuthStore.getState().mfaPending || readMfaGate()) return
  if (recentlyMarkedVerified() && !status.verified) {
    return
  }
  const latest = useAuthStore.getState()
  useAuthStore.setState({
    mfaVerified: status.verified,
    mfaStatusKnown: true,
    mfaPending: Boolean((latest.firebaseUser || latest.user) && !status.verified),
    mfaNext: status.next
      ? safePostMfaPath(status.next, latest.mfaNext === '/developer' ? '/developer' : '/dashboard')
      : latest.mfaNext,
  })
}

function loadSignedInProfile(firebaseUser: FirebaseUser): Promise<void> {
  if (inFlightProfile?.uid === firebaseUser.uid) return inFlightProfile.promise
  const promise = loadSignedInProfileInner(firebaseUser).finally(() => {
    if (inFlightProfile?.promise === promise) inFlightProfile = null
  })
  inFlightProfile = { uid: firebaseUser.uid, promise }
  return promise
}

async function loadSignedInProfileWithWait(firebaseUser: FirebaseUser): Promise<void> {
  const pending = loadSignedInProfile(firebaseUser)
  try {
    await withTimeout(pending, PROFILE_LOAD_MS, SIGN_IN_SLOW_MESSAGE)
  } catch (error) {
    if (useAuthStore.getState().user?.id === firebaseUser.uid) return
    if (isPlatformOwnerEmail(firebaseUser.email)) {
      keepOwnerSession(firebaseUser)
      return
    }
    if (!isTimeoutError(error)) throw error
    try {
      await withTimeout(pending, PROFILE_LOAD_GRACE_MS, SIGN_IN_SLOW_MESSAGE)
    } catch (graceError) {
      if (useAuthStore.getState().user?.id === firebaseUser.uid) return
      if (isPlatformOwnerEmail(firebaseUser.email)) {
        keepOwnerSession(firebaseUser)
        return
      }
      throw graceError
    }
  }
}

function keepOwnerSession(firebaseUser: FirebaseUser) {
  const owner = platformOwnerUser(firebaseUser.uid, firebaseUser.email || PLATFORM_OWNER_EMAIL)
  useAuthStore.setState({
    user: owner,
    firebaseUser,
    organization: null,
    loading: false,
    error: null,
  })
  void firebaseUser.getIdToken(true).catch(() => undefined)
}

function recoverOwnerSession(email?: string | null): boolean {
  if (useAuthStore.getState().mfaPending) return false
  if (readSignedOutFlag()) return false
  try {
    const current = getFirebaseAuth().currentUser
    if (current && isPlatformOwnerEmail(current.email || email)) {
      keepOwnerSession(current)
      return true
    }
  } catch {
    /* Firebase not ready — fall through to the in-memory session. */
  }
  const loaded = useAuthStore.getState().user
  if (loaded && isPlatformOwnerEmail(loaded.email || email)) {
    useAuthStore.setState({ loading: false, error: null })
    return true
  }
  return false
}

async function loadProfileWithRetries(firebaseUser: FirebaseUser): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < PROFILE_ATTEMPTS; attempt += 1) {
    if (useAuthStore.getState().user?.id === firebaseUser.uid) return
    try {
      await loadSignedInProfileWithWait(firebaseUser)
      if (useAuthStore.getState().user?.id === firebaseUser.uid) return
      const settled = useAuthStore.getState().error
      if (settled && !isRetryableAuthLoadError(new Error(settled))) return
      lastError = new Error(settled || 'Could not load your user profile from Firestore.')
    } catch (error) {
      lastError = error
      if (useAuthStore.getState().user?.id === firebaseUser.uid) return
    }
    if (attempt === PROFILE_ATTEMPTS - 1 || !isRetryableAuthLoadError(lastError)) break
    await new Promise((resolve) => setTimeout(resolve, authLoadRetryDelayMs(attempt)))
  }
  throw lastError instanceof Error ? lastError : new Error('Could not load your user profile from Firestore.')
}

function invalidateOrganizationHydration() {
  organizationHydration += 1
}

function sessionStillOpen(uid: string, token: number): boolean {
  if (token !== organizationHydration || signingOut) return false
  const current = useAuthStore.getState()
  return current.user?.id === uid || current.firebaseUser?.uid === uid
}

async function loadOrganizationSnapshot(organizationId: string) {
  if (!organizationId) return null
  try {
    const snap = await readOrganizationDocument(getFirebaseDb(), organizationId)
    return snap.exists() ? snap : null
  } catch (error) {
    console.warn('Organisation details stayed pending:', error)
    return null
  }
}

function organizationFromSnapshot(orgDoc: NonNullable<Awaited<ReturnType<typeof loadOrganizationSnapshot>>>) {
  const orgData = orgDoc.data()
  const seededLabels = withSeededNavigationLabels(orgData.settings || {})
  const organization: Organization = {
    id: orgDoc.id,
    name: orgData.name || '',
    companyLogoURL: orgData.companyLogoURL || undefined,
    members: orgData.members || {},
    settings: seededLabels.settings,
    teamOnboarding: parseTeamOnboarding(orgData.teamOnboarding) || undefined,
    billing: parseOrgBilling(orgData as Record<string, unknown>) || undefined,
    createdAt: orgData.createdAt?.toDate() || new Date(),
    updatedAt: orgData.updatedAt?.toDate() || new Date(),
  }
  return { organization, seededLabels, orgData }
}

function publishOrganization(
  uid: string,
  token: number,
  organizationId: string,
  orgDoc: NonNullable<Awaited<ReturnType<typeof loadOrganizationSnapshot>>>
) {
  const built = organizationFromSnapshot(orgDoc)
  useAuthStore.setState((state) => {
    if (token !== organizationHydration || signingOut) return state
    if (state.user?.id !== uid || !organizationIdsMatch(state.user.organizationId, organizationId)) return state
    return { organization: built.organization }
  })
  return built
}

/** Membership and the organisation document finish after the shell is open. */
async function hydrateSignedInOrganization(
  firebaseUser: FirebaseUser,
  documentUser: User,
  documentOrganizationId: string,
  explicitOrganizationId: string | null,
  provisionalOrganizationId: string,
  token: number
) {
  try {
    const snapPromise = provisionalOrganizationId
      ? loadOrganizationSnapshot(provisionalOrganizationId)
      : Promise.resolve(null)

    void snapPromise.then((snap) => {
      if (!snap || !sessionStillOpen(firebaseUser.uid, token)) return
      publishOrganization(firebaseUser.uid, token, provisionalOrganizationId, snap)
    })

    let sessionUser = documentUser
    let probe: 'allowed' | 'denied' | 'unknown' = 'unknown'
    let membershipKnown = false
    try {
      const session = await resolveWebSessionOrganization(
        firebaseUser.uid,
        documentOrganizationId,
        explicitOrganizationId,
        { shouldPersist: () => sessionStillOpen(firebaseUser.uid, token) }
      )
      if (!sessionStillOpen(firebaseUser.uid, token)) return
      probe = session.probe
      membershipKnown = session.membership != null
      sessionUser = withWebOrganization(
        sessionUserForOrganizationProbe(documentUser, documentOrganizationId, session)
      )
      adoptCurrentOrganization(sessionUser.organizationId || '', firebaseUser.uid)
      useAuthStore.setState((state) => {
        if (token !== organizationHydration || signingOut || state.user?.id !== firebaseUser.uid) return state
        const organization =
          state.organization && organizationIdsMatch(state.organization.id, sessionUser.organizationId)
            ? state.organization
            : sessionUser.organizationId
              ? stubOrganization(sessionUser.organizationId)
              : null
        return { user: sessionUser, organization }
      })
    } catch (sessionError) {
      console.warn('Device organisation lookup skipped:', sessionError)
      const current = useAuthStore.getState().user
      if (current?.id === firebaseUser.uid) sessionUser = current
    }

    if (!sessionStillOpen(firebaseUser.uid, token)) return
    const organizationId = sessionUser.organizationId
    if (!organizationId) return

    const snap = organizationIdsMatch(organizationId, provisionalOrganizationId)
      ? await snapPromise
      : await loadOrganizationSnapshot(organizationId)
    if (!snap || !sessionStillOpen(firebaseUser.uid, token)) return
    const built = publishOrganization(firebaseUser.uid, token, organizationId, snap)
    const live = useAuthStore.getState().user
    if (!live || live.id !== firebaseUser.uid || !organizationIdsMatch(live.organizationId, organizationId)) return
    if (probe !== 'allowed' && !organizationIdsMatch(organizationId, documentOrganizationId)) return

    // The membership probe just read this document. Only write when it was missing.
    if (!membershipKnown) {
      void withTimeoutFallback(
        ensurePrimaryOrgMembership(
          firebaseUser.uid,
          organizationId,
          String(built.orgData.members?.[firebaseUser.uid] || live.role || 'member'),
          live.isSuperAdmin ? { isSuperAdmin: true } : undefined
        ),
        PROFILE_STEP_MS,
        undefined
      )
    }

    if (built.seededLabels.changed && (live.isSuperAdmin || live.permissions.adminAccess)) {
      void updateDoc(doc(getFirebaseDb(), 'organizations', organizationId), {
        'settings.uiLabels.navigationLabels': built.seededLabels.navigationLabels,
        updatedAt: new Date(),
      }).catch((seedError) => {
        console.warn('Navigation label seeding skipped:', seedError)
      })
    }
  } catch (error) {
    console.warn('Organisation details stayed pending:', error)
  }
}

function profileLoadFailed(firebaseUser: FirebaseUser, error: unknown) {
  if (useAuthStore.getState().user?.id === firebaseUser.uid) return
  if (useAuthStore.getState().mfaPending) return
  useAuthStore.setState({
    user: null,
    firebaseUser,
    organization: null,
    loading: false,
    error: error instanceof Error ? error.message : 'Could not load your user profile from Firestore.',
  })
}

async function loadSignedInProfileInner(firebaseUser: FirebaseUser) {
  const token = ++organizationHydration
  await waitForAuthToken()
  const db = getFirebaseDb()
  let userDoc = await loadUserDocumentWithRetry(firebaseUser.uid)
  if (!userDoc.exists() && firebaseUser.email) {
    await withTimeoutFallback(
      mergePlaceholderUserDocOntoAuthUidIfNeeded(firebaseUser.uid, firebaseUser.email),
      PROFILE_STEP_MS,
      false
    )
    userDoc = await loadUserDocumentWithRetry(firebaseUser.uid, 2)
  }

  if (!userDoc.exists()) {
    if (isPlatformOwnerEmail(firebaseUser.email)) {
      keepOwnerSession(firebaseUser)
      void withTimeoutFallback(
        setDoc(doc(db, 'users', firebaseUser.uid), platformOwnerProfilePayload(firebaseUser.email || ''), { merge: true }),
        PROFILE_STEP_MS,
        undefined
      ).catch((ownerProfileError) => {
        console.warn('Platform owner profile write skipped:', ownerProfileError)
      })
      return
    }
    useAuthStore.setState({
      user: null,
      firebaseUser,
      organization: null,
      loading: false,
      error:
        'Your account was created but the user profile is not in Firestore yet. Refresh the page or contact support.',
    })
    return
  }

  const parsed = parseAppUserDocument(firebaseUser.uid, userDoc.data() as Record<string, unknown>)
  if (!parsed.ok) {
    if (isPlatformOwnerEmail(firebaseUser.email)) {
      keepOwnerSession(firebaseUser)
      return
    }
    useAuthStore.setState({
      user: null,
      firebaseUser,
      organization: null,
      loading: false,
      error: parsed.errors.join('; ') || 'Could not parse your user profile.',
    })
    return
  }

  const user: User = {
    ...parsed.value,
    email: parsed.value.email || firebaseUser.email || '',
  }

  const patch: Record<string, unknown> = {
    ...topLevelAdminFlagPatch(userDoc.data() as Record<string, unknown>, user),
  }
  if (!user.passwordSet) {
    user.passwordSet = true
    patch.passwordSet = true
  }
  if (user.role === 'operative' && !user.permissions.operativeMode) {
    user.permissions = { ...user.permissions, operativeMode: true }
    patch.operativeMode = true
  }
  if (user.permissions.skills) {
    user.permissions = { ...user.permissions, skills: false }
    patch.skills = false
  }

  const raw = userDoc.data() as Record<string, unknown>
  if (raw.accountConfirmed === false) {
    const token =
      (typeof raw.accountConfirmToken === 'string' && raw.accountConfirmToken) ||
      user.accountConfirmToken ||
      ''
    if (token) {
      try {
        const confirmSnap = await withTimeout(
          getDoc(doc(db, 'accountConfirmations', token)),
          PROFILE_STEP_MS,
          SIGN_IN_SLOW_MESSAGE
        )
        if (confirmSnap.exists() && confirmSnap.data().isUsed === true) {
          patch.accountConfirmed = true
          patch.accountConfirmedAt = Timestamp.now()
          user.accountConfirmed = true
        }
      } catch (confirmError) {
        console.warn('Account confirmation lookup skipped:', confirmError)
      }
    }
  }

  if (Object.keys(patch).length > 0) {
    user.updatedAt = new Date()
  }

  const documentOrganizationId = user.organizationId
  const explicitOrganizationId = readExplicitSwitchOrganization()
  const rememberedOrganizationId = readWebActiveOrg(firebaseUser.uid)
  const provisionalOrganizationId = provisionalWebOrganizationId({
    explicitOrganizationId,
    rememberedOrganizationId,
    documentOrganizationId,
  })
  const sessionUser = withWebOrganization(
    provisionalOrganizationId && !organizationIdsMatch(provisionalOrganizationId, documentOrganizationId)
      ? { ...user, organizationId: provisionalOrganizationId }
      : user
  )
  // Remember an explicit switch or the company already stored for this browser.
  // Do not copy users/{uid}.organizationId into pp.webActiveOrg.
  const rememberProvisional =
    Boolean(explicitOrganizationId) ||
    Boolean(rememberedOrganizationId && organizationIdsMatch(provisionalOrganizationId, rememberedOrganizationId))
  if (provisionalOrganizationId && rememberProvisional) {
    writeWebActiveOrg(firebaseUser.uid, provisionalOrganizationId)
  }

  adoptCurrentOrganization(sessionUser.organizationId || '', firebaseUser.uid)
  const currentOrganization = useAuthStore.getState().organization
  useAuthStore.setState({
    user: sessionUser,
    firebaseUser,
    currentUserDocument: raw,
    organization:
      currentOrganization && organizationIdsMatch(currentOrganization.id, sessionUser.organizationId)
        ? currentOrganization
        : sessionUser.organizationId
          ? stubOrganization(sessionUser.organizationId)
          : null,
    loading: false,
    error: null,
  })
  commitExplicitSwitchOrganization(sessionUser.organizationId)
  watchCurrentUserDocument(firebaseUser.uid)
  void hydrateSignedInOrganization(
    firebaseUser,
    user,
    documentOrganizationId,
    explicitOrganizationId,
    provisionalOrganizationId,
    token
  )

  void import('@/lib/analytics/trackEvent').then(({ trackEvent }) => {
    if (isPlatformOwnerEmail(user.email) || isPlatformOwnerSentinelOrg(user.organizationId)) return
    if (typeof window !== 'undefined') {
      try {
        if (window.sessionStorage.getItem('pp.loginTracked') === '1') return
        window.sessionStorage.setItem('pp.loginTracked', '1')
      } catch {
        /* private mode */
      }
    }
    void trackEvent('user_logged_in', { userId: user.id, organizationId: user.organizationId })
    void trackEvent('login', { userId: user.id, organizationId: user.organizationId, metadata: { source: 'web' } })
  })

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = Timestamp.now()
    void withTimeoutFallback(
      updateDoc(doc(db, 'users', firebaseUser.uid), patch),
      PROFILE_STEP_MS,
      undefined
    ).catch((profileFixError) => {
      console.warn('Profile flag repair skipped:', profileFixError)
    })
  }
}

export const useAuthStore = create<AuthState>((set) => {
  if (typeof window !== 'undefined' && isFirebaseConfigured()) {
    const auth = getFirebaseAuth()
    void auth.authStateReady().catch(() => undefined)

    onAuthStateChanged(auth, async (firebaseUser) => {
      if (signingIn) {
        if (firebaseUser) {
          useAuthStore.setState({ firebaseUser, loading: true })
        }
        return
      }
      if (
        signingOut ||
        (readSignedOutFlag() && !useAuthStore.getState().mfaPending && !isMfaGateOpen(firebaseUser?.uid))
      ) {
        invalidateOrganizationHydration()
        if (firebaseUser) {
          try {
            await firebaseSignOut(getFirebaseAuth())
          } catch {
            /* already signed out */
          }
        }
        set({
          user: null,
          firebaseUser: null,
          currentUserDocument: null,
          organization: null,
          loading: false,
          mfaPending: false,
          mfaVerified: false,
          mfaStatusKnown: true,
          mfaNext: '',
        })
        return
      }
      if (firebaseUser) {
        if (
          isWebIdleExpired(Date.now(), readWebIdleLastActivity()) &&
          !useAuthStore.getState().mfaPending &&
          !isMfaGateOpen(firebaseUser.uid) &&
          !isPlatformOwnerSession(firebaseUser.email, useAuthStore.getState().user?.organizationId)
        ) {
          try {
            await firebaseSignOut(getFirebaseAuth())
          } catch (idleSignOutError) {
            console.warn('Idle sign-out skipped:', idleSignOutError)
          }
          markWebIdleExpired()
          stopCurrentUserWatch()
          invalidateOrganizationHydration()
          adoptCurrentOrganization('', '')
          set({ user: null, firebaseUser: null, currentUserDocument: null, organization: null, loading: false, error: null })
          return
        }
        if (readWebIdleLastActivity() == null) noteWebIdleActivity()
        if (!useAuthStore.getState().user) {
          useAuthStore.setState({ firebaseUser, loading: true, error: null })
        }
        if (!useAuthStore.getState().mfaPending && !isMfaGateOpen(firebaseUser.uid)) {
          void syncMfaStatusFromCookie()
        }
        try {
          await loadProfileWithRetries(firebaseUser)
        } catch (authLoadError) {
          if (isPlatformOwnerEmail(firebaseUser.email)) {
            keepOwnerSession(firebaseUser)
            return
          }
          console.error('Failed to load user profile:', authLoadError)
          profileLoadFailed(firebaseUser, authLoadError)
        }
      } else if (!signingIn && !useAuthStore.getState().mfaPending) {
        if (recentlyMarkedVerified()) return
        try {
          await withTimeout(auth.authStateReady(), 5000, 'auth-ready')
        } catch {
          /* Persistence can be slow on the first visit. */
        }
        const restored = auth.currentUser
        if (shouldHoldSignedOutCallback({ authReady: true, hasCurrentUser: Boolean(restored) })) {
          if (restored && useAuthStore.getState().user?.id !== restored.uid) {
            void loadProfileWithRetries(restored).catch((error) => profileLoadFailed(restored, error))
          }
          return
        }
        stopCurrentUserWatch()
        invalidateOrganizationHydration()
        set({
          user: null,
          firebaseUser: null,
          currentUserDocument: null,
          organization: null,
          loading: false,
          mfaPending: false,
          mfaVerified: false,
          mfaStatusKnown: true,
          mfaNext: '',
        })
      }
    })
  }

  return {
    user: null,
    firebaseUser: null,
    currentUserDocument: null,
    organization: null,
    loading: true,
    error: null,
    mfaPending: false,
    mfaVerified: false,
    mfaStatusKnown: false,
    mfaNext: '',
    setMfaPending: (mfaPending) => set({ mfaPending }),
    markMfaVerified: () => {
      lastVerifiedAt = Date.now()
      const hasUser = Boolean(useAuthStore.getState().user)
      set({ mfaPending: false, mfaVerified: true, mfaStatusKnown: true, loading: hasUser ? false : true })
    },

    signIn: async (email: string, password: string, opts) => {
      const nextPath = safePostMfaPath(opts?.next, opts?.next?.startsWith('/developer') ? '/developer' : '/dashboard')
      signingIn = true
      writeSignedOutFlag(false)
      noteWebIdleActivity()
      try {
        set({
          loading: true,
          error: null,
          mfaPending: true,
          mfaVerified: false,
          mfaStatusKnown: true,
          mfaNext: nextPath,
        })
        const auth = getFirebaseAuth()
        const firebaseUser = await completeEmailSignIn(auth, email, password)
        openMfaGate(firebaseUser.uid, nextPath)
        await clearMfaCookiesOnly()
        set({
          firebaseUser,
          mfaPending: true,
          mfaVerified: false,
          mfaStatusKnown: true,
          mfaNext: nextPath,
          loading: false,
          error: null,
        })
        void startEmailMfa(nextPath).catch((startError) => {
          console.warn('Verification email is still sending:', startError)
        })
        throw new MfaRequiredError()
      } catch (error: unknown) {
        if (isMfaRequiredError(error)) {
          set({ loading: false, error: null, mfaPending: true, mfaVerified: false, mfaStatusKnown: true })
          throw error
        }
        set({
          loading: false,
          mfaPending: false,
          mfaVerified: false,
          mfaStatusKnown: true,
        })
        const message = error instanceof Error ? error.message : 'Sign in failed'
        set({ loading: false, error: message })
        throw error
      } finally {
        signingIn = false
        try {
          const current = getFirebaseAuth().currentUser
          if (current && useAuthStore.getState().user?.id !== current.uid) {
            void loadProfileWithRetries(current).catch((error) => profileLoadFailed(current, error))
          }
        } catch {
          /* Auth is not ready yet. The listener will load the profile. */
        }
      }
    },

    signUp: async (email: string, password: string, organizationName: string) => {
      try {
        set({ loading: true, error: null })
        const auth = getFirebaseAuth()
        const db = getFirebaseDb()
        const result = await createUserWithEmailAndPassword(auth, email, password)

        const orgId = crypto.randomUUID().toUpperCase()
        await setDoc(doc(db, 'organizations', orgId), {
          name: organizationName,
          members: { [result.user.uid]: 'admin' },
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        await seedOrgDefaultDashboard(orgId)

        await setDoc(doc(db, 'users', result.user.uid), {
          email,
          firstName: '',
          surname: '',
          organizationId: orgId,
          role: 'admin',
          isActive: true,
          passwordSet: true,
          isSuperAdmin: true,
          adminAccess: true,
          manager: true,
          operatives: true,
          skills: false,
          qualifications: true,
          materials: true,
          projects: true,
          smallWorks: true,
          operativeMode: false,
          siteAudit: true,
          subContractors: true,
          wholesalersOrderHistory: true,
          dailyOverview: true,
          policyAccepted: false,
          accountConfirmed: true,
          employmentType: 'self_employed',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        await grantMfaSkip()
        set({ loading: false, mfaPending: false, mfaVerified: true, mfaStatusKnown: true })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Sign up failed'
        set({ loading: false, error: message })
        throw error
      }
    },

    signUpOwner: async (password: string) => {
      try {
        set({ loading: true, error: null })
        const auth = getFirebaseAuth()
        const db = getFirebaseDb()
        const result = await createUserWithEmailAndPassword(auth, PLATFORM_OWNER_EMAIL, password)
        await result.user.getIdToken(true).catch(() => undefined)
        await setDoc(doc(db, 'users', result.user.uid), platformOwnerProfilePayload(PLATFORM_OWNER_EMAIL), { merge: true })
        await loadSignedInProfileWithWait(result.user)
        await grantMfaSkip()
        noteWebIdleActivity()
        set({ loading: false, mfaPending: false, mfaVerified: true, mfaStatusKnown: true })
      } catch (error: unknown) {
        if (recoverOwnerSession(PLATFORM_OWNER_EMAIL) || useAuthStore.getState().user) {
          set({ loading: false, error: null })
          return
        }
        const message = error instanceof Error ? error.message : 'Could not create the owner login'
        set({ loading: false, error: message })
        throw error
      }
    },

    changePassword: async (currentPassword: string, nextPassword: string) => {
      const auth = getFirebaseAuth()
      const current = auth.currentUser
      if (!current?.email) throw new Error('You need to be signed in to change your password.')
      const credential = EmailAuthProvider.credential(current.email, currentPassword)
      await reauthenticateWithCredential(current, credential)
      await updatePassword(current, nextPassword)
    },

    signOut: async (opts) => {
      signingOut = true
      invalidateOrganizationHydration()
      stopCurrentUserWatch()
      adoptCurrentOrganization('', '')
      const signedOutId = useAuthStore.getState().user?.id
      if (signedOutId) clearRememberedOrgDenied(signedOutId)
      writeSignedOutFlag(true)
      try {
        if (opts?.idle) markWebIdleExpired()
        else clearWebIdleActivity()
        await clearMfaSession()
        await firebaseSignOut(getFirebaseAuth())
        set({
          user: null,
          firebaseUser: null,
          currentUserDocument: null,
          organization: null,
          mfaPending: false,
          mfaVerified: false,
          mfaStatusKnown: true,
          mfaNext: '',
          error: null,
          loading: false,
        })
      } catch (error: unknown) {
        try {
          await firebaseSignOut(getFirebaseAuth())
        } catch {
          /* still clear local state */
        }
        set({
          user: null,
          firebaseUser: null,
          currentUserDocument: null,
          organization: null,
          mfaPending: false,
          mfaVerified: false,
          mfaStatusKnown: true,
          mfaNext: '',
          error: null,
          loading: false,
        })
        const message = error instanceof Error ? error.message : 'Sign out failed'
        set({ error: message })
        throw error
      } finally {
        signingOut = false
        redirectAfterSignOut()
      }
    },

    resetPassword: async (email: string) => {
      try {
        set({ loading: true, error: null })
        await sendPasswordResetEmail(getFirebaseAuth(), email, passwordResetActionSettings(email))
        set({ loading: false })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Reset failed'
        set({ loading: false, error: message })
        throw error
      }
    },

    checkAuth: () => {
      // Auth state is handled by onAuthStateChanged
    },

    reloadSignedInProfile: async () => {
      let current: FirebaseUser | null = null
      try {
        current = getFirebaseAuth().currentUser
      } catch {
        return
      }
      if (!current) return
      await loadProfileWithRetries(current)
    },

    ensureSignedInProfile: async () => {
      let current: FirebaseUser | null = null
      try {
        current = getFirebaseAuth().currentUser
      } catch {
        return
      }
      if (!current) return
      if (useAuthStore.getState().user?.id === current.uid && !useAuthStore.getState().error) return
      set({ loading: true, error: null, firebaseUser: current })
      try {
        await loadProfileWithRetries(current)
      } catch (error) {
        profileLoadFailed(current, error)
      }
    },

    recordLastSeenIfDue: async () => {
      const { firebaseUser, user } = useAuthStore.getState()
      if (!firebaseUser || !user) return
      const now = Date.now()
      if (now - lastSeenWriteAt < LAST_SEEN_THROTTLE_MS) return
      lastSeenWriteAt = now
      try {
        await updateDoc(doc(getFirebaseDb(), 'users', firebaseUser.uid), {
          lastSeenAt: Timestamp.now(),
        })
        useAuthStore.setState({
          user: { ...user, lastSeenAt: new Date() },
        })
      } catch (error) {
        console.warn('lastSeenAt heartbeat failed:', error)
      }
    },
  }
})
