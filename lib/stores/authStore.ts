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
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { seedOrgDefaultDashboard } from '@/lib/dashboard/dashboardLayoutStorage'
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { isFirebaseConfigured } from '@/lib/firebase/env'
import { loadUserDocumentWithRetry } from '@/lib/firebase/loadUserDocument'
import type { User, Organization } from '@/types'
import { UserRole } from '@/types'
import { parseUserPermissions } from '@/lib/navigation/menuPermissions'
import { withSeededNavigationLabels } from '@/lib/navigation/sharedUiLabels'
import { parseTeamOnboarding } from '@/lib/orgSetup/teamOnboarding'

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  organization: Organization | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, organizationName: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  checkAuth: () => void
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Initialize auth state listener
  if (typeof window !== 'undefined' && isFirebaseConfigured()) {
    onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await loadUserDocumentWithRetry(firebaseUser.uid)
          if (userDoc.exists()) {
          const userData = userDoc.data()
          const db = getFirebaseDb()
          const isSuperAdmin = userData.isSuperAdmin === true
          const user: User = {
            id: firebaseUser.uid,
            email: userData.email || firebaseUser.email || '',
            firstName: userData.firstName || '',
            surname: userData.surname || '',
            organizationId: userData.organizationId || '',
            role: (userData.role as UserRole) || UserRole.BASIC,
            isActive: userData.isActive !== false,
            passwordSet: userData.passwordSet !== false,
            isSuperAdmin,
            permissions: parseUserPermissions(userData, isSuperAdmin),
            annualLeaveEnabled: userData.annualLeaveEnabled !== false,
            policyAccepted: userData.policyAccepted === true,
            policyAcceptedAt: userData.policyAcceptedAt?.toDate(),
            createdAt: userData.createdAt?.toDate() || new Date(),
            updatedAt: userData.updatedAt?.toDate() || new Date(),
          }
          
          // Load organization
          let organization: Organization | null = null
          if (user.organizationId) {
            const orgDoc = await getDoc(doc(db, 'organizations', user.organizationId))
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

              if (seededLabels.changed && (user.isSuperAdmin || user.permissions.adminAccess)) {
                try {
                  await updateDoc(doc(db, 'organizations', user.organizationId), {
                    'settings.uiLabels.navigationLabels': seededLabels.navigationLabels,
                    updatedAt: new Date(),
                  })
                } catch (seedError) {
                  // Non-blocking: label seeding should never block login.
                  console.warn('Navigation label seeding skipped:', seedError)
                }
              }
            }
          }
          
          set({
            user,
            firebaseUser,
            organization,
            loading: false,
          })
        } else {
          set({
            user: null,
            firebaseUser,
            organization: null,
            loading: false,
            error:
              'Your account was created but the user profile is not in Firestore yet. Refresh the page or contact support.',
          })
        }
        } catch (authLoadError) {
          console.error('Failed to load user profile:', authLoadError)
          set({
            user: null,
            firebaseUser,
            organization: null,
            loading: false,
            error: 'Could not load your user profile from Firestore.',
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
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
        set({ loading: false })
      } catch (error: any) {
        set({ loading: false, error: error.message })
        throw error
      }
    },
    
    signUp: async (email: string, password: string, organizationName: string) => {
      try {
        set({ loading: true, error: null })
        const auth = getFirebaseAuth()
        const db = getFirebaseDb()
        const result = await createUserWithEmailAndPassword(auth, email, password)
        
        // Create organization
        const orgId = crypto.randomUUID()
        await setDoc(doc(db, 'organizations', orgId), {
          name: organizationName,
          members: { [result.user.uid]: 'admin' },
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        await seedOrgDefaultDashboard(orgId)
        
        // Create user document
        await setDoc(doc(db, 'users', result.user.uid), {
          email,
          firstName: '',
          surname: '',
          organizationId: orgId,
          role: 'admin',
          isActive: true,
          passwordSet: true,
          isSuperAdmin: true,
          permissions: {
            adminAccess: true,
            manager: true,
            operatives: true,
            skills: true,
            qualifications: true,
            materials: true,
            projects: true,
            smallWorks: true,
            operativeMode: false,
            siteAudit: true,
            subContractors: true,
            wholesalersOrderHistory: true,
          },
          policyAccepted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        
        set({ loading: false })
      } catch (error: any) {
        set({ loading: false, error: error.message })
        throw error
      }
    },
    
    signOut: async () => {
      try {
        await firebaseSignOut(getFirebaseAuth())
        set({ user: null, firebaseUser: null, organization: null })
      } catch (error: any) {
        set({ error: error.message })
        throw error
      }
    },
    
    resetPassword: async (email: string) => {
      try {
        set({ loading: true, error: null })
        await sendPasswordResetEmail(getFirebaseAuth(), email)
        set({ loading: false })
      } catch (error: any) {
        set({ loading: false, error: error.message })
        throw error
      }
    },
    
    checkAuth: () => {
      // Auth state is handled by onAuthStateChanged
    },
  }
})




