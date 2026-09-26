import type { Country } from './types.ts'

export interface CountryInfo {
  code: Country
  path: string
  label: string
  currency: string
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'CA', path: '/ca', label: 'Canada', currency: 'CAD' },
  { code: 'US', path: '/us', label: 'USA', currency: 'USD' },
]
