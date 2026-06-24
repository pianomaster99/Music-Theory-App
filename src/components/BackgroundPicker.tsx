import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BACKGROUNDS, useBackground } from '@/lib/backgrounds'

export function BackgroundPicker({ compact }: { compact?: boolean }) {
  const { theme, setThemeId } = useBackground()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {compact ? theme.emoji : `${theme.emoji} Scene`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Choose your scene</DialogTitle>
          <DialogDescription>
            The lesson will sit {theme.stage}. Pick a backdrop for your voyage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setThemeId(b.id)}
              className={cn(
                'group relative h-24 overflow-hidden rounded-xl border-2 text-left transition-transform hover:scale-[1.03]',
                theme.id === b.id ? 'border-ink ring-2 ring-ink/40' : 'border-ink/30',
              )}
            >
              <span aria-hidden className="absolute inset-0" style={b.layerStyle} />
              <span
                className={cn(
                  'absolute bottom-1 left-1 rounded-md bg-black/45 px-1.5 py-0.5 text-xs font-medium text-white',
                )}
              >
                {b.emoji} {b.label}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
