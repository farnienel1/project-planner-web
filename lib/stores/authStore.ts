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
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import type { User, Organization } from '@/types'
import { UserRole } from '@/types'

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
  if (typeof window !== 'undefined') {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Load user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          const user: User = {
            id: firebaseUser.uid,
            email: userData.email || firebaseUser.email || '',
            firstName: userData.firstName || '',
            surname: userData.surname || '',
            organizationId: userData.organizationId || '',
            role: (userData.role as UserRole) || UserRole.BASIC,
            isActive: userData.isActive !== false,
            passwordSet: userData.passwordSet !== false,
            isSuperAdmin: userData.isSuperAdmin === true,
            permissions: {
              adminAccess: userData.adminAccess === true || userData.isSuperAdmin === true,
              operatives: userData.operatives === true || userData.isSuperAdmin === true,
              skills: userData.skills === true || userData.isSuperAdmin === true,
              qualifications: userData.qualifications === true || userData.isSuperAdmin === true,
              projects: userData.projects === true || userData.isSuperAdmin === true,
              smallWorks: userData.smallWorks === true || userData.isSuperAdmin === true,
            },
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
              organization = {
                id: orgDoc.id,
                name: orgData.name || '',
                members: orgData.members || {},
                settings: orgData.settings || {},
                createdAt: orgData.createdAt?.toDate() || new Date(),
                updatedAt: orgData.updatedAt?.toDate() || new Date(),
              }
            }
          }
          
          set({ 
            user, 
            firebaseUser,
            organization,
            loading: false 
          })
        } else {
          set({ user: null, firebaseUser: null, organization: null, loading: false })
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
        await signInWithEmailAndPassword(auth, email, password)
        set({ loading: false })
      } catch (error: any) {
        set({ loading: false, error: error.message })
        throw error
      }
    },
    
    signUp: async (email: string, password: string, organizationName: string) => {
      try {
        set({ loading: true, error: null })
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
          adminAccess: true,
          operatives: true,
          skills: true,
          qualifications: true,
          projects: true,
          smallWorks: true,
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
        await firebaseSignOut(auth)
        set({ user: null, firebaseUser: null, organization: null })
      } catch (error: any) {
        set({ error: error.message })
        throw error
      }
    },
    
    resetPassword: async (email: string) => {
      try {
        set({ loading: true, error: null })
        await sendPasswordResetEmail(auth, email)
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
