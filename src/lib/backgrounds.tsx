import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

export interface BackgroundTheme {
  id: string
  label: string
  emoji: string
  /** How the stage "sits" in the scene, e.g. "on a cloud". */
  stage: string
  layerStyle: CSSProperties
  /** Ring/border colour for the themed stage frame. */
  ring: string
  /** True when the backdrop is dark (page chrome switches to light text). */
  dark?: boolean
}

export const BACKGROUNDS: BackgroundTheme[] = [
  {
    id: 'map',
    label: 'Treasure map',
    emoji: '🗺️',
    stage: 'on the old map',
    layerStyle: {
      background:
        'radial-gradient(120% 120% at 50% 0%, #efe0bd 0%, #e3cd9f 55%, #d3b87f 100%)',
    },
    ring: '#7a5a36',
  },
  {
    id: 'space',
    label: 'Outer space',
    emoji: '🛸',
    stage: 'adrift in deep space',
    layerStyle: {
      background:
        'radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 70%, #fff, transparent), radial-gradient(2px 2px at 85% 60%, #fff, transparent), radial-gradient(1px 1px at 60% 45%, #fff, transparent), linear-gradient(160deg, #0a0f2c 0%, #1b1448 60%, #2a1a4a 100%)',
    },
    ring: '#8b7bd8',
    dark: true,
  },
  {
    id: 'forest',
    label: 'Forest',
    emoji: '🌲',
    stage: 'in a sunlit forest',
    layerStyle: {
      background:
        'radial-gradient(120% 90% at 50% -10%, #cfe8a8 0%, #8cc06a 45%, #3f7a3f 100%)',
    },
    ring: '#2f5d2f',
  },
  {
    id: 'livingroom',
    label: 'Living room',
    emoji: '🛋️',
    stage: 'in a cozy cartoon living room',
    layerStyle: {
      background:
        'linear-gradient(180deg, #f3d9b1 0%, #f3d9b1 62%, #b07a4a 62%, #9c6a3e 100%)',
    },
    ring: '#8a5a32',
  },
  {
    id: 'dungeon',
    label: 'Eerie dungeon',
    emoji: '🔒',
    stage: 'locked in an eerie dungeon',
    layerStyle: {
      background:
        'radial-gradient(120% 120% at 50% 0%, #3a3f47 0%, #23262c 60%, #15171b 100%)',
    },
    ring: '#5b6470',
    dark: true,
  },
  {
    id: 'candyland',
    label: 'Candyland',
    emoji: '🍭',
    stage: 'floating over candyland',
    layerStyle: {
      background:
        'radial-gradient(120% 110% at 50% 0%, #ffe3f3 0%, #ffc2e2 45%, #ff9ed0 100%)',
    },
    ring: '#d6589c',
  },
]

const STORAGE_KEY = 'backgroundTheme'

interface BackgroundContextValue {
  theme: BackgroundTheme
  setThemeId: (id: string) => void
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null)

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'map',
  )

  const theme = useMemo(
    () => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0],
    [id],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme.id)
  }, [theme.id])

  const value = useMemo<BackgroundContextValue>(
    () => ({ theme, setThemeId: setId }),
    [theme],
  )

  return (
    <BackgroundContext.Provider value={value}>
      <div
        aria-hidden
        className="fixed inset-0 -z-10 transition-[background] duration-500"
        style={theme.layerStyle}
      />
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground(): BackgroundContextValue {
  const ctx = useContext(BackgroundContext)
  if (!ctx)
    throw new Error('useBackground must be used within a BackgroundProvider')
  return ctx
}
