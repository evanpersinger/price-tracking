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
- Only set a brand when it's known for certain, don't guess from the name. Two narrow, hand-coded exceptions to
  "don't guess" (both in `frontend/src/`): any Costco line with "KS" as its own word (`isKirklandSignature` in
  `knownItems.ts`) defaults to `Kirkland`, and any line containing "Old Spice" (`isOldSpice` in `brands.ts`, any
  store) defaults to `Old Spice`. Both are specific, well-known cases, not a general "infer the brand" rule.
- Capitals don't matter in a brand: `Arm&Hammer` and `arm&hammer` are the same brand. `POST /api/items`
  saves a brand that matches a saved one ignoring case with the saved spelling (the first one saved wins).
  Rows edited by hand in the database aren't covered, keep their spelling consistent yourself.

## Item name is the receipt's own text

The `name` column is always the literal text printed on the receipt line (`toRow`'s `name` field in
`ReceiptReview.tsx`), never a model-cleaned rewording and never a `knownItems.ts` entry's own curated name. This is
deliberate: a later repeat purchase needs to be matched up by name when there's no item code (see Duplicate
detection below), and the receipt's own text is far more reliable for that than a generalized name would be. The
Item name box is editable like any other field on the review page, this rule is only about what it starts out as.

A `knownItems.ts` match still shows its own curated name, but only as a display override on the Stores/Cheapest/
Search pages (`itemParts` in `format.ts`), with the stored receipt text kept as a small line underneath for
reference. Nothing about the stored `name` changes because of this, it's purely how the name renders.

## Duplicate detection (not adding the same item twice)

`POST /api/items` in `backend/server.py` decides whether an incoming item is a repeat of one already in that store,
in which case it overwrites that row (keeping one row in `items`, with the old price kept in `price_history`)
instead of inserting a new one:

1. **With an `item_code`**: an exact match on `item_code` within the store. This is the reliable case.
2. **With no code** (most stores print one; a few, like Fresco, never do): a fuzzy match on name alone
   (`difflib.SequenceMatcher`, `DUPLICATE_NAME_SIMILARITY = 0.9` in `server.py`), tolerant of OCR noise (a dropped
   or swapped letter) but not much more. Brand and size are deliberately **not** checked, only the name. This was a
   simplification: since the name is now always the receipt's own text (see above), two genuinely different
   products should differ in their printed name reliably enough on its own. The known accepted risk is a false
   positive: two different products at the same codeless store with a near-identical printed name would merge.
3. A gas item (`fuel_type` set) is never matched this way, every fill-up is deliberately its own row.

## Item name vs. brand text

The frontend (`stripBrandPrefix` in `frontend/src/format.ts`) automatically hides the
brand from the Item column, but only when it's an exact, case-insensitive match at the
very start of the name, immediately followed by a space (e.g. `Villagio Hamburger Buns`
with brand `Villagio` shows as just `Hamburger Buns`). A suffix right after the brand
with no space, like the possessive in `illy's Coffee` with brand `illy`, is **not**
stripped either, same as the brand appearing anywhere else in the name below.

When the brand word appears anywhere else in the name, not the front, it does **not**
get stripped automatically. In that case, edit the name by hand to remove it once the
`brand` column is set, e.g. `Red Compliments Cheese Slices` with brand `Compliments`
becomes `Red Cheese Slices`. The brand should only ever appear once: in the Brand
column.

If the name is *only* the brand (e.g. `Pringles` with brand `Pringles`, or `Old Spice`
with brand `Old Spice`), stripping it would leave the Item column blank. Give the name a
real word beyond the brand instead, e.g. `Pringles Chips`, `Old Spice Deodorant`.

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
  `per g`/`per ml`/`per kg`, rounded to the cent, or three decimals when it's under 10
  cents. A bulk-bin item priced per kg (Bulk Barn, Bulk Barrel) still converts to per
  100g like anything else, divide by 10.
- A count: `($0.50 per bun)`, with the word after `per` naming the thing, never a bare
  `per`.
- A single pack, bottle or carton that has no useful per-weight price: `($5.50 per pack)`,
  `($14.00 per bottle)`, `($4.00 per carton)`.
- Only one unit price bracket per name. A second one that just restates the same price
  in a different unit (`per gram` next to an already-converted `per 100g`) is redundant,
  delete it rather than keep both.
- An item with only `(1x)` and no other size shows as "1 <Noun>" in the Amount column
  (a count of 1 is no longer dropped). If that reads as nonsense, like "1 Almonds" on a
  chocolate bar, the `(1x)` isn't describing a real amount and should just be removed
  from the name by hand.
- The size is the whole pack's total (`(2000g)` for 4 packs of 500g), and only one
  measurement is kept, not both `(1lb)` and `(454g)`.
- The Amount column's wording ("12 Cans", "4 Chops") comes from the name and the word after
  `per`, so it can't be set by writing it in the name. See `overrideCountNoun` in
  `frontend/src/format.ts`.

## Capsule dose (`dose_mg`)

- `items.dose_mg` is the dose on a single capsule/tablet, in mg, for supplements and similar count-sold products.
  It's optional, set by the review page's "Dose per capsule" calculator (mg or g, converted to mg; g x1000).
- A dose given in **IU** (International Units: Vitamin D, A, E and others) has no weight equivalent, so it's never
  stored in `dose_mg`. It stays part of the item name instead, e.g. `Vitamin D3 1000 IU`, same as before this
  column existed.
- Leave `dose_mg` empty for anything that isn't sold by capsule/tablet. It has no relationship to `weight_g`
  (`weight_g` is the whole pack's total, `dose_mg` is per single unit), both can be set on the same item.

## Spelling

Typos in imported item names (e.g. "Camoille" for Chamomile, "Vineagar") are generally
left as typed. `/api/cheapest` matches items fuzzily (`SIMILARITY = 0.85` in
`backend/server.py`), so small spelling differences don't break comparisons across
stores. Only fix a typo when it's explicitly flagged, don't go hunting for them.
