import { squashed } from './matchSavedStore.ts'

// Every file in ./logos, no list to keep up to date. A logo is named after its store with only lower case letters and
// digits ("canadiantire.svg", "tt.png", "traderjoes.png"), so Costco's one file serves both countries.
const files = import.meta.glob<string>('./logos/*.{svg,png,webp,jpg,jpeg}', {
  eager: true,
  import: 'default',
  query: '?url',
})

const logoByName = new Map<string, string>(
  Object.entries(files).map(([path, url]) => [squashed(path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))), url]),
)

// The logo's address for a saved store name, or undefined when no file was added for it (a store new from a receipt)
export function storeLogo(storeName: string): string | undefined {
  return logoByName.get(squashed(storeName))
}
