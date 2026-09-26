import type { Country, Store } from './types.ts'

export async function fetchStores(country: Country, signal: AbortSignal): Promise<Store[]> {
  const response = await fetch(`/api/stores?country=${country}`, { signal })
  if (!response.ok) {
    throw new Error(`The server answered ${response.status}`)
  }
  return (await response.json()) as Store[]
}
