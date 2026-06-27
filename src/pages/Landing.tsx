import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PianoMascot } from '@/components/lesson/PianoMascot'
import { course } from '@/content/course'
import { useAuth } from '@/lib/auth/AuthProvider'

const MODULE_EMOJI: Record<string, string> = {
  intervals: '📏',
  triads: '🎵',
  sevenths: '🎹',
}

const WHY = [
  {
    icon: '🛠️',
    title: 'Learn by doing',
    body: 'You build intervals and chords with your own hands — dragging notes, placing fingers, naming what you hear. No passive watching.',
  },
  {
    icon: '💡',
    title: 'Guided, never spoon-fed',
    body: 'Pianomaster99 nudges you with hints toward the answer instead of handing it over, so the understanding actually sticks.',
  },
  {
    icon: '🌀',
    title: 'Mistakes are the point',
    body: 'Getting it wrong is how you learn. Every attempt earns specific, friendly feedback — and yes, a gentle ruler tap.',
  },
]

const DO = [
  { icon: '🎼', title: 'Drag notes on a staff', body: 'Place notes on a treasure-map staff with proper sharps and flats.' },
  { icon: '✋', title: 'Play a piano with a hand', body: 'Drag a jointed hand onto a cartoon keyboard and press the keys.' },
  { icon: '🔤', title: 'Name it by dragging', body: 'Identify intervals and chords by dragging number and quality tokens.' },
  { icon: '📖', title: 'Open the reference', body: 'A built-in table of every interval and chord, with playable examples.' },
]

export default function Landing() {
  const { user } = useAuth()
  const primaryTo = user ? '/map' : '/auth'
  const primaryLabel = user ? 'Continue learning' : 'Start learning — free'

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="font-display text-2xl text-ink">🎹 Pianomaster99</span>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/play">🚀 Multiplayer</Link>
          </Button>
          {user ? (
            <Button asChild size="sm">
              <Link to="/map">My map</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-10 sm:py-16 md:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-ink-soft">
            A learn-by-doing music theory app
          </p>
          <h1 className="mt-3 font-display text-5xl leading-tight text-ink sm:text-6xl">
            Learn music theory by <span className="text-[#b5651d]">doing</span>,
            not memorizing.
          </h1>
          <p className="mt-4 max-w-prose text-xl text-ink-soft">
            Most theory is taught by drilling facts into your head. We do the
            opposite: you figure things out by interacting — building intervals,
            stacking chords, and playing a piano — while a friendly tutor guides
            you with hints. Learning science says that&rsquo;s how it sticks.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to={primaryTo}>{primaryLabel}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/play">🚀 Play the multiplayer game</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            No prior theory needed — sing into your mic and race friends, or learn at your own pace.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="relative w-full max-w-sm rounded-3xl border-2 border-ink/30 bg-parchment/70 p-6 shadow-[0_6px_0_rgba(74,53,38,0.2)]">
            <div className="flex items-end gap-3">
              <PianoMascot mood="happy" talking className="h-40 w-32 shrink-0 animate-mascot-fly" />
              <div className="mb-2 rounded-2xl border-2 border-ink/40 bg-parchment px-4 py-3 text-lg text-ink shadow-[0_3px_0_rgba(74,53,38,0.25)]">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Pianomaster99
                </p>
                <p className="mt-1 leading-snug">
                  Ahoy! Ready to figure this out together?
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multiplayer game spotlight */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border-2 border-ink/30 bg-gradient-to-b from-[#0b1026] to-[#1a2348] p-8 text-center text-white shadow-[0_6px_0_rgba(74,53,38,0.25)] sm:p-12">
          <p className="text-sm font-bold uppercase tracking-widest text-sky-200">
            New · Multiplayer
          </p>
          <h2 className="mt-2 font-display text-4xl text-white sm:text-5xl">
            🚀 Pitch Rocket Race
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-sky-100/90">
            Sing the answer to each question and your rocket blasts forward. Nail
            intervals and chords with your voice — an on-device AI listens to your
            pitch in real time. First to the finish line wins.
          </p>
          <div className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
            {[
              { icon: '🎤', title: 'Sing to answer', body: 'A browser AI detects the notes you sing — no keyboard needed.' },
              { icon: '🏁', title: 'Race live', body: 'Quick-match with random players, make a private room, or go solo.' },
              { icon: '🧠', title: 'Three modes', body: 'Noobs (intervals), Pros (chords), and Hackers (famous-music trivia).' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl bg-white/10 p-4 text-left">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-2 font-display text-xl text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-sky-100/80">{f.body}</p>
              </div>
            ))}
          </div>
          <Button asChild size="lg" className="mt-8">
            <Link to="/play">Start a race</Link>
          </Button>
        </div>
      </section>

      {/* Why it works (core concept) */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center font-display text-4xl text-ink">
          Why it works
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-lg text-ink-soft">
          Built on the Socratic method: you learn by interacting with each
          lesson, not by being told the answer.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {WHY.map((w) => (
            <div
              key={w.title}
              className="rounded-2xl border-2 border-ink/25 bg-parchment/60 p-6 shadow-[0_4px_0_rgba(74,53,38,0.18)]"
            >
              <div className="text-4xl">{w.icon}</div>
              <h3 className="mt-3 font-display text-2xl text-ink">{w.title}</h3>
              <p className="mt-2 text-ink-soft">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What you'll do */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center font-display text-4xl text-ink">
          What you&rsquo;ll actually do
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DO.map((d) => (
            <div
              key={d.title}
              className="rounded-2xl border-2 border-ink/25 bg-parchment/60 p-5 text-center shadow-[0_4px_0_rgba(74,53,38,0.18)]"
            >
              <div className="text-4xl">{d.icon}</div>
              <h3 className="mt-2 font-display text-xl text-ink">{d.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum preview */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center font-display text-4xl text-ink">
          Your voyage
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-lg text-ink-soft">
          Three modules take you from the very basics to seventh chords.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {course.modules.map((m, i) => (
            <div
              key={m.id}
              className="flex items-start gap-4 rounded-2xl border-2 border-ink/25 bg-parchment/60 p-5 shadow-[0_4px_0_rgba(74,53,38,0.18)]"
            >
              <div className="text-4xl">{MODULE_EMOJI[m.id] ?? '🎶'}</div>
              <div>
                <h3 className="font-display text-2xl text-ink">
                  {i + 1}. {m.title}
                </h3>
                <p className="mt-1 text-ink-soft">{m.description}</p>
                <p className="mt-2 text-sm font-bold text-ink-soft">
                  {m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="font-display text-4xl text-ink">
          Ready to chart the course?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">
          Create a free account and Pianomaster99 will meet you at the first
          island.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to={primaryTo}>{primaryLabel}</Link>
        </Button>
      </section>

      <footer className="border-t-2 border-ink/15 py-6 text-center text-sm text-ink-soft">
        Made for curious beginners. 🎹
      </footer>
    </div>
  )
}
