import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { playReferenceA } from '@/lib/audio'
import { useAuth } from '@/lib/auth/AuthProvider'
import { generateRoundQuestions } from '@/lib/game/questions'
import { matchesAnswer } from '@/lib/game/answerMatch'
import { applyCorrect, DEFAULT_TARGET } from '@/lib/game/scoring'
import { submitTime } from '@/lib/game/leaderboard'
import { useStableNotes } from '@/lib/game/useStableNotes'
import { MODE_LABELS, type GameMode, type Player, type Question } from '@/lib/game/types'
import RocketTrack from '@/components/game/RocketTrack'
import QuestionCard from '@/components/game/QuestionCard'

type Phase = 'setup' | 'countdown' | 'racing' | 'done'

const COUNTDOWN_S = 3

interface Prog {
  currentIndex: number
  correctCount: number
  effectiveScore: number
  finished: boolean
}
const ZERO: Prog = { currentIndex: 0, correctCount: 0, effectiveScore: 0, finished: false }

function parseMode(v: string | null): GameMode {
  return v === 'pros' || v === 'hackers' ? v : 'noobs'
}

function distinctRecent(buf: number[], n: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (let i = buf.length - 1; i >= 0 && out.length < n; i--) {
    if (!seen.has(buf[i])) {
      seen.add(buf[i])
      out.push(buf[i])
    }
  }
  return out.reverse()
}

export default function SoloRace() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, ensureGuest } = useAuth()
  const mode = parseMode(params.get('mode'))
  const target = DEFAULT_TARGET

  const [phase, setPhase] = useState<Phase>('setup')
  const [questions, setQuestions] = useState<Question[]>([])
  const [myIndex, setMyIndex] = useState(0)
  const [capturedPcs, setCapturedPcs] = useState<number[]>([])
  const [justCorrect, setJustCorrect] = useState(false)
  const [prog, setProg] = useState<Prog>({ ...ZERO })
  const [countdown, setCountdown] = useState(COUNTDOWN_S)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const progRef = useRef<Prog>({ ...ZERO })
  const recentPcsRef = useRef<number[]>([])
  const startTimeRef = useRef(0)
  const phaseRef = useRef<Phase>('setup')
  const questionsRef = useRef<Question[]>([])
  const submittedRef = useRef(false)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  const name = profile?.displayName || user?.displayName || 'You'

  const onStableNote = useCallback(
    ({ pc }: { pc: number; midi: number }) => {
      if (phaseRef.current !== 'racing' || progRef.current.finished) return
      const qs = questionsRef.current
      if (!qs.length) return
      const q = qs[progRef.current.currentIndex % qs.length]
      if (!q) return

      recentPcsRef.current.push(pc)
      if (recentPcsRef.current.length > 8) recentPcsRef.current.shift()

      if (matchesAnswer(recentPcsRef.current, q.answerPcs, q.relative)) {
        const next = applyCorrect(progRef.current, target)
        const currentIndex = progRef.current.currentIndex + 1
        progRef.current = { ...next, currentIndex }
        recentPcsRef.current = []
        setProg(progRef.current)
        setMyIndex(currentIndex)
        setCapturedPcs([])
        setJustCorrect(true)
        window.setTimeout(() => setJustCorrect(false), 600)
        if (next.finished) {
          const ms = Date.now() - startTimeRef.current
          setElapsedMs(ms)
          setPhase('done')
          if (!submittedRef.current) {
            submittedRef.current = true
            void ensureGuest(name)
              .then((u) =>
                submitTime({ uid: u.uid, name, mode, timeMs: ms, target }),
              )
              .catch(() => {})
          }
        }
      } else {
        setCapturedPcs(distinctRecent(recentPcsRef.current, q.answerPcs.length))
      }
    },
    [target, ensureGuest, name, mode],
  )

  const mic = useStableNotes({ holdMs: 500, onStableNote })

  // Elapsed timer while racing.
  useEffect(() => {
    if (phase !== 'racing') return
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 100)
    return () => window.clearInterval(id)
  }, [phase])

  const beginRacing = useCallback(() => {
    // Mic was already started from the Start button (a user gesture) so the
    // AudioContext is running by now; just begin scoring.
    progRef.current = { ...ZERO }
    recentPcsRef.current = []
    submittedRef.current = false
    setProg({ ...ZERO })
    setMyIndex(0)
    setCapturedPcs([])
    startTimeRef.current = Date.now()
    setPhase('racing')
  }, [])

  // Stable ref so the countdown interval isn't recreated every render (mic — and
  // thus beginRacing — change identity each render, which would reset the timer).
  const beginRacingRef = useRef(beginRacing)
  useEffect(() => {
    beginRacingRef.current = beginRacing
  })

  // Countdown -> racing. Depends only on `phase`, so the interval is created once
  // and counts down 3->2->1 without being reset by re-renders.
  useEffect(() => {
    if (phase !== 'countdown') return
    let n = COUNTDOWN_S
    const id = window.setInterval(() => {
      n -= 1
      if (n <= 0) {
        window.clearInterval(id)
        beginRacingRef.current()
      } else {
        setCountdown(n)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const handleStart = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      // Start the mic FIRST, within the button's user gesture, so the browser
      // lets the AudioContext run (otherwise it stays suspended and no audio is
      // captured). It warms up during the countdown.
      await mic.start()
      const { questions: qs } = await generateRoundQuestions(mode, 20)
      if (!qs.length) {
        setError('Could not build questions. Try again.')
        setBusy(false)
        return
      }
      setQuestions(qs)
      questionsRef.current = qs
      setCountdown(COUNTDOWN_S)
      setPhase('countdown')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [mode, mic])

  const handleSkip = useCallback(() => {
    const currentIndex = progRef.current.currentIndex + 1
    progRef.current = { ...progRef.current, currentIndex }
    recentPcsRef.current = []
    setCapturedPcs([])
    setMyIndex(currentIndex)
  }, [])

  const handlePlayAgain = useCallback(() => {
    void mic.stop()
    setPhase('setup')
    setElapsedMs(0)
  }, [mic])

  useEffect(() => {
    if (phase === 'done') void mic.stop()
  }, [phase, mic])

  const mePlayer: Player = useMemo(
    () => ({
      uid: user?.uid ?? 'me',
      name,
      isGuest: !!user?.isAnonymous,
      currentIndex: myIndex,
      correctCount: prog.correctCount,
      effectiveScore: prog.effectiveScore,
      finished: prog.finished,
      finishMs: prog.finished ? elapsedMs : null,
    }),
    [user, name, myIndex, prog, elapsedMs],
  )

  const len = questions.length
  const question = len ? questions[myIndex % len] : null

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-ink-soft">
            Solo · {MODE_LABELS[mode]}
          </p>
          <h1 className="font-display text-3xl text-ink">Time Trial</h1>
        </div>
        <div className="text-right">
          <div className="text-xs text-ink-soft">time</div>
          <div className="font-mono text-2xl text-ink">
            {(elapsedMs / 1000).toFixed(1)}s
          </div>
        </div>
      </header>

      {phase === 'setup' && (
        <div className="rounded-2xl border-2 border-ink/30 bg-parchment/60 p-6 text-center">
          <p className="text-ink-soft">
            Race the clock: sing the answer to each question to boost your rocket
            to the finish line ({target} points). Reach{' '}
            <span className="font-medium text-ink">{target}</span> as fast as you can.
          </p>
          {error && <p className="mt-3 text-sm text-[#9b3b2f]">{error}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/play')}>
              Back
            </Button>
            <Button variant="outline" onClick={() => void playReferenceA()}>
              🔊 Hear middle A
            </Button>
            <Button size="lg" onClick={handleStart} disabled={busy}>
              {busy ? 'Building questions…' : 'Start (enable mic)'}
            </Button>
          </div>
        </div>
      )}

      {phase !== 'setup' && (
        <RocketTrack players={[mePlayer]} target={target} myUid={mePlayer.uid} />
      )}

      {phase === 'countdown' && (
        <div className="rounded-2xl border-2 border-ink/30 bg-parchment/60 p-10 text-center">
          <div className="font-display text-7xl text-ink">{countdown}</div>
          <p className="mt-2 text-ink-soft">Get ready to sing…</p>
        </div>
      )}

      {phase === 'racing' && question && (
        <>
          {mic.status === 'loading' && (
            <p className="text-center text-ink-soft">Warming up the mic…</p>
          )}
          {mic.error && <p className="text-center text-sm text-[#9b3b2f]">{mic.error}</p>}
          <QuestionCard
            question={question}
            index={myIndex}
            total={len}
            capturedPcs={capturedPcs}
            holdProgress={mic.holdProgress}
            reading={mic.reading}
            level={mic.level}
            onSkip={handleSkip}
            justCorrect={justCorrect}
          />
        </>
      )}

      {phase === 'done' && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-parchment/60 p-8 text-center">
          <h2 className="font-display text-4xl text-ink">Finished!</h2>
          <p className="mt-2 text-ink-soft">
            Your time:{' '}
            <span className="font-mono text-ink">{(elapsedMs / 1000).toFixed(1)}s</span>{' '}
            · submitted to the {MODE_LABELS[mode]} leaderboard.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/play')}>
              Back to lobby
            </Button>
            <Button size="lg" onClick={handlePlayAgain}>
              Play again
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
