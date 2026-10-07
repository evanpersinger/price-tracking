export interface Abbreviation {
  abbr: string
  meaning: string
}

// Short tags Evan uses in item names, not to be confused with the many plain spelling mistakes in imported names
// (those are typos, left as-is since /api/cheapest matches fuzzily; this list is for intentional shorthand).
export const ABBREVIATIONS: Abbreviation[] = [
  { abbr: 'DC', meaning: 'Decaf' },
  { abbr: 'FF', meaning: 'Fat free' },
  { abbr: 'GF', meaning: 'Gluten free' },
  { abbr: 'LF', meaning: 'Low fat' },
  { abbr: 'LS', meaning: 'Low sodium' },
  { abbr: 'LT', meaning: 'Light' },
  { abbr: 'OG', meaning: 'Organic' },
  { abbr: 'SF', meaning: 'Sugar free' },
  { abbr: 'SS', meaning: 'Sesame seed' },
  { abbr: 'UF', meaning: 'Unflavored' },
  { abbr: 'WG', meaning: 'Whole grain' },
  { abbr: 'WW', meaning: 'Whole wheat' },
]
