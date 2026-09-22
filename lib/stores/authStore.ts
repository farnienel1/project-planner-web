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
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { withTimeout, withTimeoutFallback, isTimeoutError } from '@/lib/client/withTimeout'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { isFirebaseConfigured } from '@/lib/firebase/env'
import { loadUserDocumentWithRetry } from '@/lib/firebase/loadUserDocument'
import { mergePlaceholderUserDocOntoAuthUidIfNeeded } from '@/lib/firebase/mergePlaceholderUser'
import { parseAppUserDocument } from '@/lib/ios-parity/converters'
import type { User, Organization } from '@/types'
import { withSeededNavigationLabels } from '@/lib/navigation/sharedUiLabels'
import { parseTeamOnboarding } from '@/lib/orgSetup/teamOnboarding'
import { topLevelAdminFlagPatch } from '@/lib/orgSetup/repairAdminFlags'
import { ACCOUNT_UNCONFIRMED_MESSAGE } from '@/lib/orgSetup/accountConfirmation'
import { ensurePrimaryOrgMembership } from '@/lib/orgMembership/membershipService'
import {
  completeEmailSignIn,
  SIGN_IN_SLOW_MESSAGE,
} from '@/lib/auth/completeEmailSignIn'
import {
  clearWebIdleActivity,
  isWebIdleExpired,
  markWebIdleExpired,
  readWebIdleLastActivity,
  touchWebIdleActivity,
} from '@/lib/auth/webIdleSession'
import { isPlatformOwnerEmail, isPlatformOwnerSentinelOrg, isPlatformOwnerSession, PLATFORM_OWNER_EMAIL } from '@/lib/platform/owner'
import { platformOwnerProfilePayload, platformOwnerUser } from '@/lib/platform/ownerProfile'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  organization: Organization | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, organizationName: string) => Promise<void>
  signUpOwner: (password: string) => Promise<void>
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>
  signOut: (opts?: { idle?: boolean }) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  checkAuth: () => void
  recordLastSeenIfDue: () => Promise<void>
}

const LAST_SEEN_THROTTLE_MS = 120_000
const PROFILE_LOAD_MS = 20_000
const PROFILE_LOAD_GRACE_MS = 15_000
const PROFILE_STEP_MS = 4000

let lastSeenWriteAt = 0
let inFlightProfile: { uid: string; promise: Promise<void> } | null = null

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

async function loadSignedInProfileInner(firebaseUser: FirebaseUser) {
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

  let organization: Organization | null = null
  if (user.organizationId) {
    const orgDoc = await withTimeout(
      getDoc(doc(db, 'organizations', user.organizationId)),
      PROFILE_STEP_MS,
      SIGN_IN_SLOW_MESSAGE
    )
    if (orgDoc.exists()) {
      const orgData = orgDoc.data()
      const seededLabels = withSeededNavigationLabels(orgData.settings || {})
      organization = {
        id: orgDoc.id,
        name: orgData.name || '',
        companyLogoURL: orgData.companyLogoURL || undefined,
        members: orgData.members || {},
        settings: seededLabels.settings,
        teamOnboarding: parseTeamOnboarding(orgData.teamOnboarding) || undefined,
        createdAt: orgData.createdAt?.toDate() || new Date(),
        updatedAt: orgData.updatedAt?.toDate() || new Date(),
      }

      void withTimeoutFallback(
        ensurePrimaryOrgMembership(
          firebaseUser.uid,
          user.organizationId,
          String(orgData.members?.[firebaseUser.uid] || user.role || 'member')
        ),
        PROFILE_STEP_MS,
        undefined
      )

      if (seededLabels.changed && (user.isSuperAdmin || user.permissions.adminAccess)) {
        void updateDoc(doc(db, 'organizations', user.organizationId), {
          'settings.uiLabels.navigationLabels': seededLabels.navigationLabels,
          updatedAt: new Date(),
        }).catch((seedError) => {
          console.warn('Navigation label seeding skipped:', seedError)
        })
      }
    }
  }

  useAuthStore.setState({
    user,
    firebaseUser,
    organization,
    loading: false,
    error: null,
  })

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
    trackEvent('user_logged_in', { userId: user.id, organizationId: user.organizationId })
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
    onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        if (
          isWebIdleExpired(Date.now(), readWebIdleLastActivity()) &&
          !isPlatformOwnerSession(firebaseUser.email, useAuthStore.getState().user?.organizationId)
        ) {
          try {
            await firebaseSignOut(getFirebaseAuth())
          } catch (idleSignOutError) {
            console.warn('Idle sign-out skipped:', idleSignOutError)
          }
          markWebIdleExpired()
          set({ user: null, firebaseUser: null, organization: null, loading: false, error: null })
          return
        }
        if (readWebIdleLastActivity() == null) touchWebIdleActivity()
        try {
          await loadSignedInProfileWithWait(firebaseUser)
        } catch (authLoadError) {
          if (isPlatformOwnerEmail(firebaseUser.email)) {
            keepOwnerSession(firebaseUser)
            return
          }
          if (useAuthStore.getState().user?.id === firebaseUser.uid) return
          console.error('Failed to load user profile:', authLoadError)
          set({
            user: null,
            firebaseUser,
            organization: null,
            loading: false,
            error:
              authLoadError instanceof Error
                ? authLoadError.message
                : 'Could not load your user profile from Firestore.',
          })
        }
      } else {
        set({ user: null, firebaseUser: null, organization: null, loading: false })
      }
    })
  }

  return {
    user: null,
    firebaseUser: null,
    organization: null,
    loading: true,
    error: null,

    signIn: async (email: string, password: string) => {
      try {
        set({ loading: true, error: null })
        const auth = getFirebaseAuth()
        const firebaseUser = await completeEmailSignIn(auth, email, password)
        if (isPlatformOwnerEmail(firebaseUser.email || email)) {
          await firebaseUser.getIdToken(true).catch(() => undefined)
        }

        await loadSignedInProfileWithWait(firebaseUser)
        const loaded = useAuthStore.getState().user
        if (loaded && loaded.accountConfirmed === false && !isPlatformOwnerEmail(firebaseUser.email)) {
          await firebaseSignOut(getFirebaseAuth())
          clearWebIdleActivity()
          set({
            user: null,
            firebaseUser: null,
            organization: null,
            loading: false,
            error: ACCOUNT_UNCONFIRMED_MESSAGE,
          })
          throw new Error(ACCOUNT_UNCONFIRMED_MESSAGE)
        }
        touchWebIdleActivity()
        set({ loading: false })
      } catch (error: unknown) {
        if (recoverOwnerSession(email) || useAuthStore.getState().user) {
          set({ loading: false, error: null })
          return
        }
        const message = error instanceof Error ? error.message : 'Sign in failed'
        set({ loading: false, error: message })
        throw error
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

        set({ loading: false })
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
        touchWebIdleActivity()
        set({ loading: false })
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
      try {
        if (opts?.idle) markWebIdleExpired()
        else clearWebIdleActivity()
        await firebaseSignOut(getFirebaseAuth())
        set({ user: null, firebaseUser: null, organization: null })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Sign out failed'
        set({ error: message })
        throw error
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
