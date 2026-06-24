import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { loadProfile, scaleForMinutes, type Profile } from '@/lib/profile'
import { setQuestionScale } from '@/content/generate'

interface AuthContextValue {
  user: User | null
  loading: boolean
  profile: Profile | null
  profileLoading: boolean
  signUp: (name: string, email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const fetchProfile = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null)
      setProfileLoading(false)
      setQuestionScale(1)
      return
    }
    setProfileLoading(true)
    try {
      const p = await loadProfile(u.uid)
      setProfile(p)
      setQuestionScale(p ? scaleForMinutes(p.dailyMinutes) : 1)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      void fetchProfile(u)
    })
  }, [fetchProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      profile,
      profileLoading,
      async signUp(name, email, password) {
        const trimmed = name.trim()
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(cred.user, { displayName: trimmed })
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayName: trimmed,
          onboarded: false,
          createdAt: serverTimestamp(),
        })
      },
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password)
      },
      async signInWithGoogle() {
        const provider = new GoogleAuthProvider()
        const cred = await signInWithPopup(auth, provider)
        // First time with Google? Seed a user doc so RequireAuth routes them
        // through onboarding (where they pick a name, hand, pace, etc.).
        const ref = doc(db, 'users', cred.user.uid)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          await setDoc(ref, {
            displayName: cred.user.displayName ?? '',
            onboarded: false,
            createdAt: serverTimestamp(),
          })
        }
        await fetchProfile(cred.user)
      },
      async signOutUser() {
        await signOut(auth)
      },
      async reloadProfile() {
        await fetchProfile(auth.currentUser)
      },
    }),
    [user, loading, profile, profileLoading, fetchProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
