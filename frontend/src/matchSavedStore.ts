import type { Store } from './types.ts'

// Lower case with only letters and digits, padded with spaces so a name matches only as whole words
function plain(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim()} `
}

// Same, but with the spaces squashed out too, only for an exact match below. A model reads a store's name as
// separate words ("FRESH CO") about as often as run together ("FreshCo"), and that split shouldn't stop it
// matching the one saved name; unlike plain(), this never substring-matches, so "Metro" still won't match inside
// "Metropolitan Market".
export function squashed(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// True when some run of neighbouring words in the receipt's name, joined with no spaces, is the saved name run together:
// "THE BULK BARREL" and "SPORT CHEK #1234" hold the saved "BulkBarrel" and "SportChek". Whole words only, so "Metro" is
// not found inside "Metropolitan".
function holdsRunTogether(receiptStore: string, savedName: string): boolean {
  const words = receiptStore.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
  const target = squashed(savedName)
  return words.some((_, start) => {
    let joined = ''
    for (let end = start; end < words.length && joined.length < target.length; end++) {
      joined += words[end]
    }
    return joined === target
  })
}

// The saved store a receipt's store name points to, or null when none does. The same name ignoring case, or one that
// holds the other as whole words, like "Costco 530" or "COSTCO WHOLESALE" for the saved "Costco". With several matches
// the longest saved name wins.
export function matchSavedStore(receiptStore: string, stores: Store[]): Store | null {
  const wanted = plain(receiptStore)
  if (wanted.trim().length < 3) return null

  const matches = stores.filter((store) => {
    const name = plain(store.name)
    return wanted.includes(name) || name.includes(wanted) || holdsRunTogether(receiptStore, store.name)
  })
  return matches.reduce<Store | null>((best, store) => (best === null || store.name.length > best.name.length ? store : best), null)
}
