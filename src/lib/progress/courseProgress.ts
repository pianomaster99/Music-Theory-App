import { isProblemStep, type Lesson } from '@/lib/content/types'
import { allLessons, type LessonLocation } from '@/content/course'
import type { LessonProgress } from './progress'

export type LessonStatus = 'complete' | 'in-progress' | 'available' | 'locked'

export interface LessonState {
  location: LessonLocation
  status: LessonStatus
  /** Fraction of the lesson's problems solved, 0..1. */
  mastery: number
  solvedCount: number
  problemCount: number
}

function problemStepIds(lesson: Lesson): string[] {
  return lesson.steps.filter(isProblemStep).map((s) => s.id)
}

/**
 * Combine the authored course with the learner's saved progress into a
 * per-lesson view: status (locked/available/in-progress/complete) and mastery.
 * Every lesson is unlocked — learners can freely jump to any lesson — while
 * status still reflects how far they've gotten.
 */
export function computeCourseState(
  progress: Record<string, LessonProgress>,
): LessonState[] {
  const lessons = allLessons()
  const states: LessonState[] = []

  for (const location of lessons) {
    const { lesson } = location
    const p = progress[lesson.id]
    const problemIds = problemStepIds(lesson)
    const problemCount = problemIds.length
    const solvedCount = p
      ? problemIds.filter((id) => p.completedStepIds.includes(id)).length
      : 0
    const completed = p?.completed === true
    const touched =
      !!p && (solvedCount > 0 || p.currentStepIndex > 0 || completed)
    const mastery =
      problemCount === 0
        ? completed
          ? 1
          : 0
        : Math.min(solvedCount / problemCount, 1)

    let status: LessonStatus
    if (completed) status = 'complete'
    else if (touched) status = 'in-progress'
    else status = 'available'

    states.push({ location, status, mastery, solvedCount, problemCount })
  }

  return states
}

/** The single lesson we should nudge the learner toward next. */
export function recommendNext(states: LessonState[]): LessonState | undefined {
  return (
    states.find((s) => s.status === 'in-progress') ??
    states.find((s) => s.status === 'available')
  )
}

export interface CourseTotals {
  completed: number
  total: number
}

export function courseTotals(states: LessonState[]): CourseTotals {
  return {
    completed: states.filter((s) => s.status === 'complete').length,
    total: states.length,
  }
}
