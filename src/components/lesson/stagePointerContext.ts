import { createContext, useContext } from 'react'

export interface StagePointerApi {
  /** Fly the mascot in and point at a DOM element with an optional callout. */
  point: (el: Element | null, message?: string) => void
  clear: () => void
}

export const StagePointerContext = createContext<StagePointerApi | null>(null)

export function useStagePointer(): StagePointerApi | null {
  return useContext(StagePointerContext)
}
