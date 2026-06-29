import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { allLessons } from '@/content/course'
import { isProblemStep } from '@/lib/content/types'
import { saveLessonProgress } from '@/lib/progress/progress'

export type HandGender = 'male' | 'female'
export type HandSkin = 'light' | 'tan' | 'brown' | 'deep'
/** Highest module the learner already feels comfortable with (skipped). */
export type Experience = 'new' | 'intervals' | 'triads'

export interface Profile {
  displayName: string
  onboarded: boolean
  handGender: HandGender
  handSkin: HandSkin
  /** Expected minutes per day; drives how many questions each lesson serves. */
  dailyMinutes: number
  experience: Experience
}

export const DEFAULT_PROFILE: Profile = {
  displayName: '',
  onboarded: false,
  handGender: 'male',
  handSkin: 'light',
  dailyMinutes: 20,
  experience: 'new',
}

export const HAND_SKINS: { id: HandSkin; label: string; swatch: string }[] = [
  { id: 'light', label: 'Light', swatch: '#f1c9a5' },
  { id: 'tan', label: 'Tan', swatch: '#d39e7b' },
  { id: 'brown', label: 'Brown', swatch: '#a06b47' },
  { id: 'deep', label: 'Deep', swatch: '#6b4327' },
]

// CSS filters that retint the (light-toned) hand artwork toward each skin tone.
export const HAND_SKIN_FILTER: Record<HandSkin, string> = {
  light: 'none',
  tan: 'sepia(0.35) saturate(1.15) brightness(0.94)',
  brown: 'sepia(0.55) saturate(1.3) brightness(0.78) hue-rotate(-8deg)',
  deep: 'sepia(0.7) saturate(1.4) brightness(0.55) hue-rotate(-10deg)',
}

/** Map expected daily minutes to a question-count multiplier. */
export function scaleForMinutes(minutes: number): number {
  if (minutes <= 10) return 0.6
  if (minutes <= 20) return 1
  if (minutes <= 40) return 1.4
  return 1.8
}

export async function loadProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    displayName: typeof d.displayName === 'string' ? d.displayName : '',
    onboarded: d.onboarded === true,
    handGender: d.handGender === 'female' ? 'female' : 'male',
    handSkin: isHandSkin(d.handSkin) ? d.handSkin : 'light',
    dailyMinutes: typeof d.dailyMinutes === 'number' ? d.dailyMinutes : 20,
    experience: isExperience(d.experience) ? d.experience : 'new',
  }
}

function isHandSkin(v: unknown): v is HandSkin {
  return v === 'light' || v === 'tan' || v === 'brown' || v === 'deep'
}
function isExperience(v: unknown): v is Experience {
  return v === 'new' || v === 'intervals' || v === 'triads'
}

export interface OnboardingData {
  displayName: string
  handGender?: HandGender
  handSkin?: HandSkin
  dailyMinutes: number
  experience: Experience
}

export async function saveOnboarding(
  uid: string,
  data: OnboardingData,
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    {
      displayName: data.displayName.trim(),
      ...(data.handGender ? { handGender: data.handGender } : {}),
      ...(data.handSkin ? { handSkin: data.handSkin } : {}),
      dailyMinutes: data.dailyMinutes,
      experience: data.experience,
      onboarded: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/**
 * Mark lessons in modules the learner already knows as complete, so an
 * experienced user can skip ahead instead of grinding easy content.
 */
export async function applyExperienceSkips(
  uid: string,
  experience: Experience,
): Promise<void> {
  const skipModules =
    experience === 'triads'
      ? ['intervals', 'triads']
      : experience === 'intervals'
        ? ['intervals']
        : []
  if (skipModules.length === 0) return

  for (const loc of allLessons()) {
    if (!skipModules.includes(loc.module.id)) continue
    const problemIds = loc.lesson.steps
      .filter(isProblemStep)
      .map((s) => s.id)
      .slice(0, 500)
    await saveLessonProgress(uid, loc.lesson.id, {
      currentStepIndex: loc.lesson.steps.length,
      completedStepIds: problemIds,
      completed: true,
    })
  }
}
