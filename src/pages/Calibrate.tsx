import { useRef, useState } from 'react'

interface Pt {
  x: number
  y: number
}

function Calibrator({
  title,
  src,
  labels,
}: {
  title: string
  src: string
  labels: string[]
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [points, setPoints] = useState<Record<string, Pt>>({})
  const [active, setActive] = useState(labels[0])
  const [nat, setNat] = useState<Pt>({ x: 0, y: 0 })

  const onLoad = () => {
    const img = imgRef.current
    if (img) setNat({ x: img.naturalWidth, y: img.naturalHeight })
  }

  const onClick = (e: React.MouseEvent) => {
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * img.naturalWidth)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * img.naturalHeight)
    setPoints((prev) => ({ ...prev, [active]: { x, y } }))
    const idx = labels.indexOf(active)
    const next = labels.find((l, i) => i > idx && !points[l])
    if (next) setActive(next)
  }

  return (
    <div className="rounded-lg border border-ink/20 bg-paper/60 p-4">
      <h2 className="mb-2 font-display text-xl text-ink">{title}</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {labels.map((l) => (
          <button
            key={l}
            onClick={() => setActive(l)}
            className={`rounded border px-3 py-1 text-sm ${
              active === l
                ? 'border-ink bg-ink text-paper'
                : points[l]
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-ink/30 text-ink'
            }`}
          >
            {l}
            {points[l] ? ' \u2713' : ''}
          </button>
        ))}
        <button
          onClick={() => setPoints({})}
          className="rounded border border-red-400 px-3 py-1 text-sm text-red-600"
        >
          Clear
        </button>
      </div>

      <div className="relative inline-block max-w-full">
        <img
          ref={imgRef}
          src={src}
          onLoad={onLoad}
          onClick={onClick}
          className="max-h-[60vh] w-auto cursor-crosshair rounded border border-ink/20 bg-[conic-gradient(#eee_90deg,#fff_0_180deg,#eee_0_270deg,#fff_0)] [background-size:24px_24px]"
        />
        {Object.entries(points).map(([label, p]) => (
          <div
            key={label}
            className="pointer-events-none absolute"
            style={{
              left: `${(p.x / (nat.x || 1)) * 100}%`,
              top: `${(p.y / (nat.y || 1)) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="h-3 w-3 rounded-full bg-red-600 ring-2 ring-white" />
            <span className="absolute left-3 top-[-2px] whitespace-nowrap rounded bg-white/90 px-1 text-[10px] text-red-700">
              {label} {p.x},{p.y}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <p className="text-xs text-ink-soft">
          Natural size: {nat.x}×{nat.y}px. Click a button, then click the knuckle on the image.
        </p>
        <pre className="mt-1 overflow-auto rounded bg-ink/90 p-2 text-xs text-paper">
{JSON.stringify(
  Object.fromEntries(Object.entries(points).map(([k, v]) => [k, [v.x, v.y]])),
  null,
  0,
)}
        </pre>
      </div>
    </div>
  )
}

export function Calibrate() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Knuckle calibration</h1>
        <p className="text-ink-soft">
          Click each knuckle to drop a red dot and read its pixel coordinate.
          Then paste the JSON (or screenshot) back to me and I'll align the
          fingers to those exact points.
        </p>
      </header>

      <Calibrator
        title="Hand — click the 5 knuckles"
        src="/hand/palm.png"
        labels={['thumb', 'index', 'middle', 'ring', 'pinky']}
      />
      <Calibrator
        title="Finger — click its knuckle (where it joins the hand)"
        src="/hand/finger.png"
        labels={['knuckle']}
      />
      <Calibrator
        title="Thumb — click its knuckle (where it joins the hand)"
        src="/hand/thumb.png"
        labels={['knuckle']}
      />
    </div>
  )
}
