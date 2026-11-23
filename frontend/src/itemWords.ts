import { findClosestSpelling, normalize } from './closestSpelling.ts'

// Words that get misspelled in item names, in their correct spelling. Hand-maintained, add a word whenever a typo of
// it comes up. A plural is its own entry, since a word is never changed into its plural or singular.
const ITEM_WORDS: string[] = [
  'Barrel',
  'Broccoli',
  'Daddy',
  'Drizzilicious',
  'Pretzels',
  'Romaine',
  'Sponge',
  'Sponges',
  'Tootsie',
  'Turmeric',
  'Vinegar',
]

// The correct word in the case the typed one was written in: ALL CAPS, Capitalized or lowercase.
function inCaseOf(typed: string, correct: string): string {
  if (typed.length > 1 && typed === typed.toUpperCase()) return correct.toUpperCase()
  return typed[0] === typed[0].toUpperCase() ? correct : correct.toLowerCase()
}

// Plain words are told apart by a single letter more often than brands are ("Romano" and "Romaine" are two edits
// apart, "Barley" and "Barrel" too), so a word under 8 letters may be one edit off and a longer one two.
const EDITS_ALLOWED = (length: number): number => (length < 8 ? 1 : 2)

// An item's display name with each misspelled word corrected to the listed word it is closest to. A word that is
// already right, or that is a different form of a listed word (a longer word that starts with it like "Broccolini",
// or the singular of a listed plural like "Pretzel"), is left as typed, and so is any word that isn't close to a
// listed one. Only the display name goes through this, the receipt's own text is saved as printed since it is what
// repeat purchases are matched on.
export function fixItemWords(displayName: string): string {
  return displayName.replace(/[A-Za-z]+/g, (word) => {
    const closest = findClosestSpelling(word, ITEM_WORDS, EDITS_ALLOWED)
    if (closest === null) return word
    const typed = normalize(word)
    const correct = normalize(closest)
    if (typed.startsWith(correct) || correct === `${typed}s` || correct === `${typed}es`) return word
    return inCaseOf(word, closest)
  })
}
