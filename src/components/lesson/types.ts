import type { ValidationResult } from '@/lib/content/validate'

export interface ProblemViewProps<T> {
  step: T
  /** True once this step has been answered correctly. */
  solved: boolean
  /** Report a checked answer up to the player (drives mascot feedback + advance). */
  onResult: (result: ValidationResult, message: string) => void
}
