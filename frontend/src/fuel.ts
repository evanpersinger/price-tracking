import type { Country } from './types.ts'

// To the tenth of a cent, the way a pump shows it, a normal two decimal price would round $1.749 to $1.75
const PER_LITRE: Record<Country, Intl.NumberFormat> = {
  CA: new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }),
  US: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }),
}

// A gas fill-up, saved from a gas receipt with the fuel type. Gas lives on its own Gas Prices page, not with groceries.
export function isFuelItem(item: { fuel_type: string | null }): boolean {
  return item.fuel_type !== null
}

// What fuel cost a litre, like "$1.749", or null when there's no price or no litres to work it out from
export function pricePerLitre(priceCents: number | null, volumeMl: number | null, country: Country): string | null {
  if (priceCents === null || !volumeMl) return null
  return PER_LITRE[country].format(priceCents / 100 / (volumeMl / 1000))
}

// Litres from the saved volume in ml, like "26.204 L", without the float noise a division can leave behind
export function formatLitres(volumeMl: number): string {
  return `${Number((volumeMl / 1000).toFixed(3))} L`
}
