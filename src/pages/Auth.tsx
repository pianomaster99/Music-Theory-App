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
      default:
        return 'Something went wrong. Please try again.'
    }
  }
  return 'Something went wrong. Please try again.'
}

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from =
    (location.state as { from?: string } | null)?.from ?? '/'

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

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border-2 border-ink/30 bg-parchment/60 p-6"
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
