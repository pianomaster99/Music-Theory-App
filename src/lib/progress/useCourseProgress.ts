import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { loadAllProgress, type LessonProgress } from './progress'
import {
  computeCourseState,
  courseTotals,
  recommendNext,
} from './courseProgress'

export function useCourseProgress() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    loadAllProgress(user.uid)
      .then((p) => {
        if (!cancelled) setProgress(p)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const states = useMemo(() => computeCourseState(progress), [progress])
  const recommended = useMemo(() => recommendNext(states), [states])
  const totals = useMemo(() => courseTotals(states), [states])

  return { states, recommended, totals, loading }
}
