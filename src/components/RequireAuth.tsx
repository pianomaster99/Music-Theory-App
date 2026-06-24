import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, profile, profileLoading } = useAuth()
  const location = useLocation()

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center font-display text-2xl text-ink-soft">
        Unrolling the map...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  // New accounts (including first-time Google sign-ins with no profile doc yet)
  // must finish onboarding before reaching the map.
  if (!profile || !profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
