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
}

export interface CheapestStore {
  id: number
  name: string
  items: CheapestItem[]
}
