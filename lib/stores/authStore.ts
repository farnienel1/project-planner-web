'use client'

import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { withTimeout, withTimeoutFallback } from '@/lib/client/withTimeout'
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
  clearWebIdleActivity,
  isWebIdleExpired,
  markWebIdleExpired,
  readWebIdleLastActivity,
  touchWebIdleActivity,
} from '@/lib/auth/webIdleSession'

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  organization: Organization | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, organizationName: string) => Promise<void>
  signOut: (opts?: { idle?: boolean }) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  checkAuth: () => void
  recordLastSeenIfDue: () => Promise<void>
}

const LAST_SEEN_THROTTLE_MS = 120_000
const AUTH_SIGN_IN_MS = 8000
const PROFILE_LOAD_MS = 12000
const PROFILE_STEP_MS = 4000
const SIGN_IN_SLOW_MESSAGE =
  'Sign in is taking too long. Check your connection, refresh this page, then try again.'

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
    patch.updatedAt = Timestamp.now()
    try {
      await withTimeout(
        updateDoc(doc(db, 'users', firebaseUser.uid), patch),
        PROFILE_STEP_MS,
        SIGN_IN_SLOW_MESSAGE
      )
    } catch (profileFixError) {
      console.warn('Profile flag repair skipped:', profileFixError)
    }
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
}

export const useAuthStore = create<AuthState>((set) => {
  if (typeof window !== 'undefined' && isFirebaseConfigured()) {
    onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        if (isWebIdleExpired(Date.now(), readWebIdleLastActivity())) {
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
          await withTimeout(loadSignedInProfile(firebaseUser), PROFILE_LOAD_MS, SIGN_IN_SLOW_MESSAGE)
        } catch (authLoadError) {
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
        const emailLower = email.trim().toLowerCase()
        const existing = auth.currentUser
        const sessionMatches =
          Boolean(existing?.email) && existing!.email!.trim().toLowerCase() === emailLower

        let firebaseUser = existing
        if (!sessionMatches) {
          try {
            const credential = await withTimeout(
              signInWithEmailAndPassword(auth, emailLower, password),
              AUTH_SIGN_IN_MS,
              SIGN_IN_SLOW_MESSAGE
            )
            firebaseUser = credential.user
          } catch (signInError) {
            const after = auth.currentUser
            if (
              after?.email &&
              after.email.trim().toLowerCase() === emailLower
            ) {
              firebaseUser = after
            } else {
              throw signInError
            }
          }
        }
        if (!firebaseUser) {
          throw new Error(SIGN_IN_SLOW_MESSAGE)
        }

        await withTimeout(loadSignedInProfile(firebaseUser), PROFILE_LOAD_MS, SIGN_IN_SLOW_MESSAGE)
        const loaded = useAuthStore.getState().user
        if (loaded && loaded.accountConfirmed === false) {
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
        await sendPasswordResetEmail(getFirebaseAuth(), email)
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
