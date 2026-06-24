import type { LessonState } from './courseProgress'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  earned: boolean
}

export interface AchievementContext {
  states: LessonState[]
  totalSolved: number
  longestStreak: number
}

/** Achievements are derived from progress + streak, never stored directly. */
export function computeAchievements(ctx: AchievementContext): Achievement[] {
  const lessonsCompleted = ctx.states.filter(
    (s) => s.status === 'complete',
  ).length
  const totalLessons = ctx.states.length
  const moduleComplete = (moduleId: string) => {
    const inModule = ctx.states.filter((s) => s.location.module.id === moduleId)
    return inModule.length > 0 && inModule.every((s) => s.status === 'complete')
  }

  return [
    {
      id: 'first-lesson',
      title: 'First Steps',
      description: 'Complete your first lesson.',
      icon: '\u{1F9ED}',
      earned: lessonsCompleted >= 1,
    },
    {
      id: 'ten-problems',
      title: 'Note Hunter',
      description: 'Solve 10 problems.',
      icon: '\u{1F3AF}',
      earned: ctx.totalSolved >= 10,
    },
    {
      id: 'intervals-master',
      title: 'Interval Navigator',
      description: 'Complete the Intervals module.',
      icon: '\u{1F4D0}',
      earned: moduleComplete('intervals'),
    },
    {
      id: 'streak-3',
      title: 'On a Roll',
      description: 'Reach a 3-day practice streak.',
      icon: '\u{1F525}',
      earned: ctx.longestStreak >= 3,
    },
    {
      id: 'streak-7',
      title: 'Seasoned Explorer',
      description: 'Reach a 7-day practice streak.',
      icon: '\u2693',
      earned: ctx.longestStreak >= 7,
    },
    {
      id: 'cartographer',
      title: 'Master Cartographer',
      description: 'Chart every lesson on the map.',
      icon: '\u{1F5FA}\uFE0F',
      earned: totalLessons > 0 && lessonsCompleted === totalLessons,
    },
  ]
}
