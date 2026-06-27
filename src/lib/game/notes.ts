// Pitch-class display names (sharp spelling), shared by game UI.

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function pcName(pc: number): string {
  return PC_NAMES[((pc % 12) + 12) % 12]
}
