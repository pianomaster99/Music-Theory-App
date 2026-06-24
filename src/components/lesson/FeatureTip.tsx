import { useState } from 'react'

const PREFIX = 'featureTipSeen:'

function wasSeen(id: string): boolean {
  try {
    return localStorage.getItem(PREFIX + id) === '1'
  } catch {
    return false
  }
}

/**
 * A small, collapsible "how to use this" coach card for an interactive feature.
 * It opens automatically the first time a learner meets the feature, then stays
 * collapsed (but reopenable) once dismissed. Dismissal is remembered per id.
 */
export function FeatureTip({
  id,
  title,
  steps,
}: {
  id: string
  title: string
  steps: string[]
}) {
  const [open, setOpen] = useState(() => !wasSeen(id))

  const dismiss = () => {
    try {
      localStorage.setItem(PREFIX + id, '1')
    } catch {
      /* ignore storage errors */
    }
    setOpen(false)
  }

  return (
    <div className="rounded-2xl border-2 border-ink/30 bg-parchment/70 text-ink shadow-[0_3px_0_rgba(74,53,38,0.18)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left font-bold"
        aria-expanded={open}
      >
        <span>💡 How to use this</span>
        <span aria-hidden className="text-ink-soft">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="border-t-2 border-ink/15 px-4 py-3">
          <p className="font-display text-lg">{title}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full border-2 border-ink/40 bg-parchment px-3 py-1 text-sm font-bold text-ink hover:bg-parchment-dark"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
