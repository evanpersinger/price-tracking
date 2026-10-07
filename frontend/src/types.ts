export type Country = 'CA' | 'US'

export interface Item {
  id: number
  name: string
  price_cents: number | null
  rating: number | null
  item_count: number | null
  weight_g: number | null
  volume_ml: number | null
  purchased_on: string | null
  brand: string | null
  item_code: string | null // the product code the store prints on the receipt, empty for imported items
  fuel_type: string | null // what the fuel is on a gas receipt, as printed (Unleaded, 87, Diesel), empty for the rest
}

export interface Store {
  id: number
  name: string
  discount_text: string | null
  items: Item[]
}

export interface CheapestItem {
  id: number
  name: string
  price_cents: number
  other_stores: number // how many other stores sell it, 0 means it was only found here
  unit: 'each' | 'g' | 'ml' // what unit_price_cents is per
  unit_price_cents: number
  item_count: number | null
  weight_g: number | null
  volume_ml: number | null
  brand: string | null
  item_code: string | null
}

export interface CheapestStore {
  id: number
  name: string
  items: CheapestItem[]
}

// One recorded purchase from the price history, newest first from GET /api/history
export interface HistoryEntry {
  id: number
  item_id: number
  store_id: number
  store_name: string
  item_name: string
  brand: string | null
  fuel_type: string | null
  item_count: number | null
  weight_g: number | null
  volume_ml: number | null
  price_cents: number // what it cost on that day
  purchased_on: string
}

// One store's offer in a search result, price_cents is what that store sells it for
export interface SearchOffer {
  id: number
  store_id: number
  store_name: string
  name: string
  price_cents: number
  unit_price_cents: number // per the unit of the list it is in
  item_count: number | null
  weight_g: number | null
  volume_ml: number | null
  brand: string | null
  item_code: string | null
}

// Offers that can be ranked against each other, cheapest first
export interface SearchList {
  unit: 'each' | 'g' | 'ml'
  offers: SearchOffer[]
}

// The body of POST /api/items. A size (item_count, weight_g or volume_ml) is required, at least one of the three.
export interface NewItem {
  country: Country
  store: string
  name: string
  price_cents: number
  item_count?: number
  weight_g?: number
  volume_ml?: number
  purchased_on?: string // YYYY-MM-DD from the receipt, left out when it couldn't be read, then no price history is kept
  brand?: string
  item_code?: string
  fuel_type?: string
}

// What POST /api/receipt returns. The fields come straight from the model's reply, so any of them can be missing.
export interface ReceiptItem {
  raw_name: string // exactly as printed on the receipt
  item_name: string // the model's cleaned-up name
  price: number
  category: string | null
  quantity_info?: string | null // a line like "3 @ 2.79" printed under the item, as printed
  fuel_type?: string | null // only on a gas receipt: the grade or fuel as printed
}

export interface ReceiptResult {
  purchase_date: string | null
  store: string | null
  store_address?: string | null // the address printed under the store name, used to guess the country
  items: ReceiptItem[]
}
