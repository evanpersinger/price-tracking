// Brand names we recognize, so an item's brand can be matched against a known spelling. Hand-maintained, add a
// name whenever a new one comes up. All Canadian brands for now.
export const BRANDS: string[] = [
  'Arm & Hammer',
  'Armstrong',
  'Biscoff',
  'Black Diamond',
  'Brita',
  'Cedar',
  "Chapman's",
  'Chosen Foods',
  'Christie',
  'Club House',
  'Compliments',
  'Cracker Barrel',
  'Dare',
  'Dempsters',
  'Dunya Harvest',
  'Fibre 1',
  'Frito-Lay',
  'Great Value',
  "Joe's",
  'Kawartha Dairy',
  "Kellogg's",
  "Kimberley's",
  'Kirkland',
  'Lactantia',
  'Leanfit',
  'Lindt',
  'Lysol',
  'Maple Leaf',
  'McCain',
  'Minute Rice',
  'Mondelēz',
  'Native',
  'Natrel',
  'Natural',
  'Nature Clean',
  'Nestle',
  'No Sugar',
  'PepsiCo',
  'Premier Protein',
  'Pringles',
  'Quaker',
  'Quest',
  'Scotties',
  'Steeves Maples',
  'Sunrise Farms',
  'SunRype',
  'Tia Rose',
  'Tide',
  'Top Dog',
  'Twinings',
  'Unreal',
  'Villagio',
  'Windsor',
  'Ziploc',
]

function normalize(text: string): string {
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

// How many edits ("Fiber1" -> "Fibre 1" is 2, swapping the "er"/"re") still count as the same brand. Scaled to
// length (roughly 30%, capped at 3) so a short name like "Dare" isn't matched to an unrelated brand over one stray
// edit, while a longer one tolerates a swapped pair of letters, not just a single one.
function tolerance(length: number): number {
  return Math.min(3, Math.max(1, Math.round(length * 0.3)))
}

// The closest known brand to whatever was typed, correcting a misspelling or a slightly different spelling, ignoring
// case, spaces and punctuation. Null when nothing in the list is close enough, since it might just be a brand we
// don't have yet, not a typo of one we do.
export function findClosestBrand(typed: string): string | null {
  const normalizedTyped = normalize(typed)
  if (!normalizedTyped) return null
  let best: { brand: string; distance: number } | null = null
  for (const brand of BRANDS) {
    const distance = editDistance(normalizedTyped, normalize(brand))
    if (distance <= tolerance(normalizedTyped.length) && (!best || distance < best.distance)) {
      best = { brand, distance }
    }
  }
  return best?.brand ?? null
}
