import type { Store } from './types.ts'

// Lower case with only letters and digits, padded with spaces so a name matches only as whole words
function plain(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim()} `
}

// The saved store a receipt's store name points to, or null when none does. The same name ignoring case, or one that
// holds the other as whole words, like "Costco 530" or "COSTCO WHOLESALE" for the saved "Costco". With several matches
// the longest saved name wins.
export function matchSavedStore(receiptStore: string, stores: Store[]): Store | null {
  const wanted = plain(receiptStore)
  if (wanted.trim().length < 3) return null

  const matches = stores.filter((store) => {
    const name = plain(store.name)
    return wanted.includes(name) || name.includes(wanted)
  })
  return matches.reduce<Store | null>((best, store) => (best === null || store.name.length > best.name.length ? store : best), null)
}
