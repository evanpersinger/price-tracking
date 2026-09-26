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
