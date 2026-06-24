import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '@/firebase'

export interface LessonProgress {
  /** Step index the learner should resume at. */
  currentStepIndex: number
  /** IDs of problem steps the learner has solved. */
  completedStepIds: string[]
  /** Whether the lesson has been finished at least once. */
  completed: boolean
}

function progressRef(uid: string, lessonId: string) {
  return doc(db, 'users', uid, 'progress', lessonId)
}

export async function loadLessonProgress(
  uid: string,
  lessonId: string,
): Promise<LessonProgress | null> {
  const snap = await getDoc(progressRef(uid, lessonId))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    currentStepIndex:
      typeof d.currentStepIndex === 'number' ? d.currentStepIndex : 0,
    completedStepIds: Array.isArray(d.completedStepIds)
      ? (d.completedStepIds as string[])
      : [],
    completed: d.completed === true,
  }
}

/** Load progress for every lesson the learner has touched, keyed by lessonId. */
export async function loadAllProgress(
  uid: string,
): Promise<Record<string, LessonProgress>> {
  const snap = await getDocs(collection(db, 'users', uid, 'progress'))
  const out: Record<string, LessonProgress> = {}
  snap.forEach((docSnap) => {
    const d = docSnap.data()
    out[docSnap.id] = {
      currentStepIndex:
        typeof d.currentStepIndex === 'number' ? d.currentStepIndex : 0,
      completedStepIds: Array.isArray(d.completedStepIds)
        ? (d.completedStepIds as string[])
        : [],
      completed: d.completed === true,
    }
  })
  return out
}

export async function saveLessonProgress(
  uid: string,
  lessonId: string,
  progress: LessonProgress,
): Promise<void> {
  await setDoc(
    progressRef(uid, lessonId),
    {
      currentStepIndex: progress.currentStepIndex,
      completedStepIds: progress.completedStepIds,
      completed: progress.completed,
      updatedAt: serverTimestamp(),
      ...(progress.completed ? { completedAt: serverTimestamp() } : {}),
    },
    { merge: true },
  )
}
