// Lowercase letters and digits only, so case, spaces and punctuation never count as a difference.
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Edit distance between two strings (single-character insertions, deletions and substitutions).
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previousDiagonal = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const previous = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? previousDiagonal : 1 + Math.min(previousDiagonal, dp[j], dp[j - 1])
      previousDiagonal = previous
    }
  }
  return dp[b.length]
}

// How many edits ("Fiber1" -> "Fibre 1" is 2, swapping the "er"/"re") still count as the same name. Scaled to length
// (roughly 30%, capped at 3) so a longer name tolerates a swapped pair of letters, not just a single one.
function tolerance(length: number): number {
  return Math.min(3, Math.max(1, Math.round(length * 0.3)))
}

// Names where both sides are shorter than this must match exactly (apart from case and punctuation), since one edit
// turns "Care" into "Dare" or "Guest" into "Quest", a different name.
const MIN_LENGTH_FOR_TYPOS = 6

// The closest of the known spellings to whatever was typed, correcting a misspelling or a slightly different spelling,
// ignoring case, spaces and punctuation. When two are equally close the one listed first wins. Null when nothing is
// close enough, since the typed name might just be one we don't know yet, not a typo of one we do. How many edits
// count as close is up to the caller, a stricter one for plain words ("Romano" is not a typo of "Romaine").
export function findClosestSpelling(
  typed: string,
  known: readonly string[],
  editsAllowed: (length: number) => number = tolerance,
): string | null {
  const normalizedTyped = normalize(typed)
  if (!normalizedTyped) return null
  let best: { spelling: string; distance: number } | null = null
  for (const spelling of known) {
    const normalizedKnown = normalize(spelling)
    const distance = editDistance(normalizedTyped, normalizedKnown)
    const allowed = Math.max(normalizedTyped.length, normalizedKnown.length) < MIN_LENGTH_FOR_TYPOS ? 0 : editsAllowed(normalizedTyped.length)
    if (distance <= allowed && (!best || distance < best.distance)) {
      best = { spelling, distance }
    }
  }
  return best?.spelling ?? null
}
