import { CANADIAN_CITIES } from './cities.ts'
import type { Country, Store } from './types.ts'

const CANADIAN_POSTAL_CODE = /\b[ABCEGHJKLMNPRSTVXY]\d[A-Z] ?\d[A-Z]\d\b/i // like N6H 4L1
const PROVINCE_CODE = /\b(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/ // upper case only, "on" is a word
const AMERICAN_ZIP = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/ // a state and ZIP, like TX 78701

// Lower case, no periods, Saint as St, so "ST. THOMAS" and "Saint Thomas" are the same, padded so whole words match
function plain(text: string): string {
  return ` ${text.toLowerCase().replace(/\./g, '').replace(/\bsaint\b/g, 'st').replace(/[^a-z0-9']+/g, ' ').trim()} `
}

// The country a store address points to, or null when it doesn't say. First the city, then the postal code or ZIP, and
// failing that the province. A state and ZIP rule the city out, since London, Windsor and Waterloo are American towns too.
function guessFromAddress(address: string | null | undefined): Country | null {
  if (!address) return null
  const looksAmerican = AMERICAN_ZIP.test(address)
  const text = plain(address)
  if (!looksAmerican && CANADIAN_CITIES.some((city) => text.includes(plain(city)))) return 'CA'
  if (CANADIAN_POSTAL_CODE.test(address) || PROVINCE_CODE.test(address)) return looksAmerican ? null : 'CA'
  return looksAmerican ? 'US' : null
}

// The one country whose saved stores include this store, or null when both do (Costco) or neither does (a new
// store). Names match ignoring case and when either one contains the other, since a receipt prints
// "REAL CANADIAN SUPERSTORE #1234" for the saved "Canadian Superstore".
function guessFromStoreName(store: string, canadianStores: Store[], americanStores: Store[]): Country | null {
  const wanted = store.trim().toLowerCase()
  if (wanted.length < 3) return null

  const sells = (stores: Store[]) =>
    stores.some((candidate) => {
      const name = candidate.name.toLowerCase()
      return name.includes(wanted) || wanted.includes(name)
    })
  const inCanada = sells(canadianStores)
  const inUsa = sells(americanStores)
  if (inCanada === inUsa) return null
  return inCanada ? 'CA' : 'US'
}

// The country a receipt was probably from: the address first, then the store name. Null means the person picks.
export function guessCountry(
  store: string,
  address: string | null | undefined,
  canadianStores: Store[],
  americanStores: Store[],
): Country | null {
  return guessFromAddress(address) ?? guessFromStoreName(store, canadianStores, americanStores)
}
