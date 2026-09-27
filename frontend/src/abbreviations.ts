export interface Abbreviation {
  abbr: string
  meaning: string
}

// Short tags Evan uses in item names, not to be confused with the many plain spelling mistakes in imported names
// (those are typos, left as-is since /api/cheapest matches fuzzily; this list is for intentional shorthand).
export const ABBREVIATIONS: Abbreviation[] = [
  { abbr: 'SS', meaning: 'Sesame seed' },
  { abbr: 'LF', meaning: 'Low fat' },
]
