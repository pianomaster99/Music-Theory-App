import type { Course, Lesson, Module } from '@/lib/content/types'
import { intervalsModule } from './intervals'

// The single course. Modules are authored elsewhere and registered here.
export const course: Course = {
  id: 'music-theory',
  subject: 'Music Theory',
  modules: [intervalsModule],
}

export interface LessonLocation {
  module: Module
  lesson: Lesson
  /** Flat index across the whole course. */
  index: number
}

/** Flatten all lessons in course order, tagged with their module. */
export function allLessons(): LessonLocation[] {
  const result: LessonLocation[] = []
  let index = 0
  for (const module of course.modules) {
    for (const lesson of module.lessons) {
      result.push({ module, lesson, index })
      index++
    }
  }
  return result
}

export function getLessonLocation(lessonId: string): LessonLocation | undefined {
  return allLessons().find((l) => l.lesson.id === lessonId)
}

/** The next lesson in course order after the given lesson, if any. */
export function nextLesson(lessonId: string): LessonLocation | undefined {
  const lessons = allLessons()
  const i = lessons.findIndex((l) => l.lesson.id === lessonId)
  if (i === -1) return undefined
  return lessons[i + 1]
}
