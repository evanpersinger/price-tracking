import { splitItemCode } from './itemCode.ts'

// Brand names we recognize, so an item's brand can be matched against a known spelling. Hand-maintained, add a
// name whenever a new one comes up. All Canadian brands for now.
export const BRANDS: string[] = [
  "Allen's",
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
  'Doritos',
  'Dunya Harvest',
  'Fairlife',
  'Fibre 1',
  'Frito-Lay',
  'Gigantico',
  'Great Value',
  'illy',
  "Joe's",
  'Kawartha Dairy',
  "Kellogg's",
  "Kimberley's",
  'Kirkland',
  'Lactantia',
  'Leanfit',
  'Lindt',
  'Loacker',
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
  'Old Spice',
  'Orange Naturals',
  'PepsiCo',
  'Philips',
  'Phyzik',
  'Pirouline',
  'Premier Protein',
  'Pringles',
  'Quaker',
  'Quest',
  'Scotties',
  'Sprite',
  'Steeves Maples',
  'Sunrise Farms',
  'SunRype',
  'Tia Rosa',
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

// Brands spelled out in item names: the printed word in capitals, and the brand it stands for. Two hand-maintained
// sections, add a line whenever one comes up.

// ALL STORES: applied to every store, for a name nothing else could be mistaken for (the same reasoning as
// isOldSpice). Keep it to unmistakable brands, a word that could be a plain description ("Natural") belongs in a
// specific store's section instead.
export const ALL_STORES_BRAND_WORDS: Record<string, string> = {
  DORITOS: 'Doritos',
  FAIRLIFE: 'Fairlife',
  PHILIPS: 'Philips',
  SPRITE: 'Sprite',
}

// SPECIFIC STORES: only applied at that store, a word that is a brand at one store can be something else at another.
// Grouped by store like KNOWN_ITEMS in knownItems.ts, a group applies when the receipt's store name contains the
// group's name, ignoring case. If a group has the same word as the all stores section, the group wins.
export const SPECIFIC_STORES_BRAND_WORDS: Record<string, Record<string, string>> = {
  Adonis: { BLACKDI: 'Black Diamond' },
  'Canadian Superstore': { GIGANTICO: 'Gigantico' },
  Costco: { PIROULINE: 'Pirouline' },
  Walmart: { CHIPITS: 'Chipits' },
}

// The brand a printed name spells out as a whole word ("CHIPITS S DK" at Walmart is Chipits), or null. Only a word on
// its own counts, not letters inside a longer one.
export function findBrandInName(store: string, printedName: string): string | null {
  const storeName = store.toLowerCase()
  const storeWords = Object.entries(SPECIFIC_STORES_BRAND_WORDS).find(([name]) => storeName.includes(name.toLowerCase()))?.[1]
  const words = { ...ALL_STORES_BRAND_WORDS, ...storeWords }
  for (const word of splitItemCode(printedName).name.toUpperCase().split(/[^A-Z0-9]+/)) {
    const brand = words[word]
    if (brand !== undefined) return brand
  }
  return null
}

// A printed name that says "Old Spice" is naming its own brand, so a specific known item isn't needed for the brand
// to be known (the same reasoning as isKirklandSignature in knownItems.ts, just not tied to one store).
export function isOldSpice(printedName: string): boolean {
  return splitItemCode(printedName).name.toLowerCase().includes('old spice')
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
// length (roughly 30%, capped at 3) so a longer name tolerates a swapped pair of letters, not just a single one.
function tolerance(length: number): number {
  return Math.min(3, Math.max(1, Math.round(length * 0.3)))
}

// Names where both sides are shorter than this must match exactly (apart from case and punctuation), since one edit
// turns "Care" into "Dare" or "Guest" into "Quest", a different brand.
const MIN_LENGTH_FOR_TYPOS = 6

// The closest known brand to whatever was typed, correcting a misspelling or a slightly different spelling, ignoring
// case, spaces and punctuation. Null when nothing in the list is close enough, since it might just be a brand we
// don't have yet, not a typo of one we do.
export function findClosestBrand(typed: string): string | null {
  const normalizedTyped = normalize(typed)
  if (!normalizedTyped) return null
  let best: { brand: string; distance: number } | null = null
  for (const brand of BRANDS) {
    const normalizedBrand = normalize(brand)
    const distance = editDistance(normalizedTyped, normalizedBrand)
    const allowed = Math.max(normalizedTyped.length, normalizedBrand.length) < MIN_LENGTH_FOR_TYPOS ? 0 : tolerance(normalizedTyped.length)
    if (distance <= allowed && (!best || distance < best.distance)) {
      best = { brand, distance }
    }
  }
  return best?.brand ?? null
}
