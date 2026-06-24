import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth/AuthProvider'

type Mode = 'signin' | 'signup'

function messageFor(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-email':
        return 'That email address looks invalid.'
      case 'auth/email-already-in-use':
        return 'An account already exists for that email.'
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.'
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email or password is incorrect.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again in a moment.'
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
      case 'auth/user-cancelled':
        // The learner closed the Google popup — not an error worth showing.
        return ''
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists for that email. Sign in with your password.'
      case 'auth/popup-blocked':
        return 'Your browser blocked the sign-in popup. Allow popups and retry.'
      default:
        return 'Something went wrong. Please try again.'
    }
  }
  return 'Something went wrong. Please try again.'
}

export default function Auth() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from =
    (location.state as { from?: string } | null)?.from ?? '/map'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (name.trim().length < 1) {
          setError('Please enter a name for your map.')
          setBusy(false)
          return
        }
        await signUp(name, email, password)
      } else {
        await signIn(email, password)
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(messageFor(err))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      navigate(from, { replace: true })
    } catch (err) {
      setError(messageFor(err))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <header className="mb-8 text-center">
        <p className="text-sm uppercase tracking-widest text-ink-soft">
          The Music Theory Map
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">
          {mode === 'signup' ? 'Begin your voyage' : 'Welcome back, explorer'}
        </h1>
        <p className="mx-auto mt-2 max-w-prose text-ink-soft">
          {mode === 'signup'
            ? 'Create an account to chart your progress across every island.'
            : 'Sign in to pick up where you left off.'}
        </p>
      </header>

      <div className="space-y-4 rounded-lg border-2 border-ink/30 bg-parchment/60 p-6">
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogle}
          disabled={busy}
        >
          <GoogleIcon className="h-5 w-5" />
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ink-soft">
          <span className="h-px flex-1 bg-ink/20" />
          or
          <span className="h-px flex-1 bg-ink/20" />
        </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Captain Pitchfinder"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>

        {error && (
          <p className="text-sm font-medium text-[#9b3b2f]">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? 'Please wait...'
            : mode === 'signup'
              ? 'Create account'
              : 'Sign in'}
        </Button>
      </form>
      </div>

      <p className="mt-6 text-center text-ink-soft">
        {mode === 'signup' ? 'Already have a map?' : 'New to the voyage?'}{' '}
        <button
          type="button"
          className="font-display text-ink underline underline-offset-4"
          onClick={() => {
            setError(null)
            setMode(mode === 'signup' ? 'signin' : 'signup')
          }}
        >
          {mode === 'signup' ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
