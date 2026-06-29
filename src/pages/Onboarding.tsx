import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  applyExperienceSkips,
  saveOnboarding,
  scaleForMinutes,
  type Experience,
} from '@/lib/profile'
import { setQuestionScale } from '@/content/generate'

const TIME_OPTIONS = [
  { minutes: 10, label: '~10 min', note: 'Short and sweet' },
  { minutes: 20, label: '~20 min', note: 'A steady pace' },
  { minutes: 30, label: '~30 min', note: 'Digging in' },
  { minutes: 60, label: '60+ min', note: 'Marathon explorer' },
]

const EXPERIENCE_OPTIONS: { id: Experience; label: string; note: string }[] = [
  { id: 'new', label: 'Brand new', note: 'Start from intervals' },
  { id: 'intervals', label: 'I know intervals', note: 'Skip ahead to triads' },
  { id: 'triads', label: 'I know intervals & triads', note: 'Jump to seventh chords' },
]

export default function Onboarding() {
  const { user, loading, profile, profileLoading, reloadProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [displayName, setDisplayName] = useState(
    profile?.displayName || user?.displayName || '',
  )
  const [dailyMinutes, setDailyMinutes] = useState(20)
  const [experience, setExperience] = useState<Experience>('new')
  const [busy, setBusy] = useState(false)

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-display text-2xl text-ink-soft">
        Preparing your voyage...
      </div>
    )
  }
  if (!user) return <Navigate to="/auth" replace />
  if (profile?.onboarded) return <Navigate to="/map" replace />

  const steps = ['Name', 'Daily time', 'Experience']
  const last = steps.length - 1

  const finish = async () => {
    setBusy(true)
    try {
      await saveOnboarding(user.uid, {
        displayName: displayName.trim() || 'Explorer',
        dailyMinutes,
        experience,
      })
      setQuestionScale(scaleForMinutes(dailyMinutes))
      await applyExperienceSkips(user.uid, experience)
      await reloadProfile()
      navigate('/map', { replace: true })
    } catch {
      setBusy(false)
    }
  }

  const canNext = step === 0 ? displayName.trim().length >= 1 : true

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <header className="mb-6 text-center">
        <p className="text-sm uppercase tracking-widest text-ink-soft">
          Chart your voyage
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">Set sail</h1>
      </header>

      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={cn(
              'h-2 w-10 rounded-full transition-colors',
              i <= step ? 'bg-ink' : 'bg-ink/20',
            )}
          />
        ))}
      </div>

      <div className="space-y-5 rounded-lg border-2 border-ink/30 bg-parchment/60 p-6">
        {step === 0 && (
          <div className="space-y-2">
            <Label htmlFor="username">What should we call you?</Label>
            <Input
              id="username"
              value={displayName}
              autoFocus
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Captain Pitchfinder"
              maxLength={40}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <Label>How long will you practice each day?</Label>
            <p className="text-sm text-ink-soft">
              This sets how many questions each lesson serves you.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t.minutes}
                  type="button"
                  onClick={() => setDailyMinutes(t.minutes)}
                  className={cn(
                    'rounded-lg border-2 border-ink/40 p-3 text-left text-ink transition-colors hover:bg-ink/10',
                    dailyMinutes === t.minutes && 'bg-ink text-parchment hover:bg-ink',
                  )}
                >
                  <div className="font-display text-lg">{t.label}</div>
                  <div className="text-xs opacity-80">{t.note}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label>How much theory do you already know?</Label>
            <p className="text-sm text-ink-soft">
              We&rsquo;ll let you skip past anything you&rsquo;ve mastered.
            </p>
            <div className="space-y-2 pt-1">
              {EXPERIENCE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setExperience(o.id)}
                  className={cn(
                    'w-full rounded-lg border-2 border-ink/40 p-3 text-left text-ink transition-colors hover:bg-ink/10',
                    experience === o.id && 'bg-ink text-parchment hover:bg-ink',
                  )}
                >
                  <div className="font-display text-lg">{o.label}</div>
                  <div className="text-xs opacity-80">{o.note}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            Back
          </Button>
          {step < last ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Next
            </Button>
          ) : (
            <Button onClick={finish} disabled={busy}>
              {busy ? 'Setting sail...' : 'Start exploring'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
