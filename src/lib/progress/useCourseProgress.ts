import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { loadAllProgress, type LessonProgress } from './progress'
import { loadStreak, type StreakState } from './streak'
import {
  computeCourseState,
  courseTotals,
  recommendNext,
} from './courseProgress'
import { computeAchievements } from './achievements'

export function useCourseProgress() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({})
  const [streak, setStreak] = useState<StreakState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([loadAllProgress(user.uid), loadStreak(user.uid)])
      .then(([p, s]) => {
        if (cancelled) return
        setProgress(p)
        setStreak(s)
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
  const totalSolved = useMemo(
    () => states.reduce((sum, s) => sum + s.solvedCount, 0),
    [states],
  )
  const achievements = useMemo(
    () =>
      computeAchievements({
        states,
        totalSolved,
        longestStreak: streak?.longestStreak ?? 0,
      }),
    [states, totalSolved, streak],
  )

  return {
    states,
    recommended,
    totals,
    totalSolved,
    streak,
    achievements,
    loading,
  }
}
