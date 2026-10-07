# Data conventions

Rules for how items in `backend/data/prices.db` should be organized: the `brand`
column, item names, and how unit prices get compared. Follow these when adding,
editing, or reviewing data by hand.

## Brand column

- A brand name always belongs in the `brand` column, and not in the item name column.
  If an item's name contains a brand, that brand gets set on `brand` and removed from
  the name (see Item name vs. brand text below for how to clean the name up).
- Set `brand` to a real, identifiable brand name when one exists (e.g. `Kirkland`,
  `Compliments`, `Windsor`).
- When there's genuinely no brand, set `brand` to the literal text `No Brand`, not
  `null`. `No Brand` is a real value, not a stand-in for "unknown", it means someone
  checked and confirmed the item has no brand.
- Only set a brand when it's known for certain, don't guess from the name.
- Capitals don't matter in a brand: `Arm&Hammer` and `arm&hammer` are the same brand. `POST /api/items`
  saves a brand that matches a saved one ignoring case with the saved spelling (the first one saved wins).
  Rows edited by hand in the database aren't covered, keep their spelling consistent yourself.

## Item name vs. brand text

The frontend (`stripBrandPrefix` in `frontend/src/format.ts`) automatically hides the
brand from the Item column, but only when it's an exact, case-insensitive match at the
very start of the name (e.g. `Villagio Hamburger Buns` with brand `Villagio` shows as
just `Hamburger Buns`).

When the brand word appears anywhere else in the name, not the front, it does **not**
get stripped automatically. In that case, edit the name by hand to remove it once the
`brand` column is set, e.g. `Red Compliments Cheese Slices` with brand `Compliments`
becomes `Red Cheese Slices`. The brand should only ever appear once: in the Brand
column.

A name that spells the brand differently than the curated `brand` field (a typo or
different casing) is left alone rather than fuzzy-matched or auto-stripped, see
Spelling below.

## Unit price / cheapest comparison basis

There's no fixed rule like "seasonings compare per gram, buns compare per item".
Instead, `_pick_winners` in `backend/server.py` picks the comparison basis per item,
based on whichever size field it actually has, in this order of preference:

1. **Count** (`item_count`, or `(Nx)` in the name) -> compared per item (`each`)
2. **Weight** (`weight_g`) -> compared per gram
3. **Volume** (`volume_ml`) -> compared per ml

A seasoning that's only ever sold by weight naturally ends up compared per gram.
Hamburger buns or cheese slices that carry a count naturally end up compared per item.
Nothing needs to be configured per category, it falls out of whatever size fields the
item was given.

## Typed unit price in a name

Imported items carry a unit price in brackets at the end of the name, which the UI shows
in the Unit price column and the API ignores (it works the comparison out itself). The
conventions used when filling these in by hand:

- Weight or volume: always `($4.41 per 100g)` or `($0.30 per 100ml)`, never `per gram`/
  `per g`/`per ml`, rounded to the cent, or three decimals when it's under 10 cents.
- A count: `($0.50 per bun)`, with the word after `per` naming the thing, never a bare
  `per`.
- A single pack, bottle or carton that has no useful per-weight price: `($5.50 per pack)`,
  `($14.00 per bottle)`, `($4.00 per carton)`.
- An item with only `(1x)` and no size is left blank.
- The size is the whole pack's total (`(2000g)` for 4 packs of 500g), and only one
  measurement is kept, not both `(1lb)` and `(454g)`.
- The Amount column's wording ("12 Cans", "4 Chops") comes from the name and the word after
  `per`, so it can't be set by writing it in the name. See `overrideCountNoun` in
  `frontend/src/format.ts`.

## Spelling

Typos in imported item names (e.g. "Camoille" for Chamomile, "Vineagar") are generally
left as typed. `/api/cheapest` matches items fuzzily (`SIMILARITY = 0.85` in
`backend/server.py`), so small spelling differences don't break comparisons across
stores. Only fix a typo when it's explicitly flagged, don't go hunting for them.
