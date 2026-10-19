# Data conventions

Rules for how items in `backend/data/prices.db` should be organized: the `brand`
column, item names, and how unit prices get compared. Follow these when adding,
editing, or reviewing data by hand.

## Brand column

- A brand name always belongs in the `brand` column. If an item's name contains a brand, that
  brand also gets set on `brand`. The name keeps it when that's what the product is called
  (`Sprite zero sugar`, `Quest Bar`), nothing hides it from the name (see Item name vs. brand
  text below).
- Set `brand` to a real, identifiable brand name when one exists (e.g. `Kirkland`,
  `Compliments`, `Windsor`).
- When there's genuinely no brand, set `brand` to the literal text `No Brand`, not
  `null`. `No Brand` is a real value, not a stand-in for "unknown", it means someone
  checked and confirmed the item has no brand.
- The brand is the name printed on the product, not the company that owns it: `Sprite`, not Coca-Cola, and
  `Doritos`, not PepsiCo.
- Only set a brand when it's known for certain, don't guess from the name. A few narrow, hand-coded exceptions to
  "don't guess" (all in `frontend/src/`): any Costco line with "KS" as its own word (`isKirklandSignature` in
  `knownItems.ts`) defaults to `Kirkland`, any line containing "Old Spice" (`isOldSpice` in `brands.ts`, any store)
  defaults to `Old Spice`, and a printed word on the hand-edited lists in `brands.ts` (`findBrandInName`) defaults to
  its brand, either at every store (`ALL_STORES_BRAND_WORDS`, only for unmistakable brands like `DORITOS`) or only at
  one store (`SPECIFIC_STORES_BRAND_WORDS`, like `CHIPITS` at Walmart). Each is a specific, well-known case, not a
  general "infer the brand" rule, and the review page's Brand box stays editable.
- Capitals don't matter in a brand: `Arm&Hammer` and `arm&hammer` are the same brand. `POST /api/items`
  saves a brand that matches a saved one ignoring case with the saved spelling (the first one saved wins).
  Rows edited by hand in the database aren't covered, keep their spelling consistent yourself.

## Item name is the receipt's own text

The `name` column is always the literal text printed on the receipt line (`receiptName` in `toRow` in
`ReceiptReview.tsx`), never a model-cleaned rewording and never a display name. This is deliberate: a later repeat
purchase needs to be matched up by name when there's no item code (see Duplicate detection below), and the receipt's
own text is far more reliable for that than a generalized name would be. Nothing the person types on the review page
changes it, the Item name box there is the display name (below).

An item with no `display_name` (an imported one, or one saved before the column existed) still gets a
`knownItems.ts` match's curated name as a stand-in at display time (`itemParts` in `format.ts`). That fallback goes
once the existing receipt items have display names.

## Display name is always given, and always paired with a receipt name

Every item added from a receipt has two names saved together on the same row:

- `name`: the **receipt name**, the literal printed text (see above).
- `display_name`: the **display name**, what a person calls the item. It is the review page's Item name box: it
  starts as a known item's curated name (`knownItems.ts`, the items we already know exist), else the saved item's
  display name for the same code, else the receipt name itself, and the person can change it. The model never makes
  one up. `POST /api/items` rejects an item without one (422), so a display name is always attached to the receipt
  name it came from, and no receipt item is saved without a display name.

The display name is what every screen shows. Only the Store Prices tables also show the receipt name, as a small line
under it (and only when it differs from the display name), every other screen shows the display name alone. The same
product at two stores has two different receipt names but should get one display name. Nothing carries a display
name over from another store yet, only known items and the same store's saved items prefill it.

Imported items have no receipt name (the name was typed in by hand), so their `display_name` stays empty and they keep
showing their `name`. They're exempt from this rule for now.

Status: the column, the API, the review page (the Item name box saves `display_name`, the printed text saves `name`)
and showing it on every screen are done. The receipt items saved before the column existed were given display names
by hand on 2026-10-14, so every item with an `item_code` has one now (backup
`backend/data/prices.backup-2026-10-14-before-display-names.db`). Only imported items still have none, they show their
`name`. Search and Cheapest matching on the server still look at `name`, not `display_name`.

## Duplicate detection (not adding the same item twice)

`POST /api/items` in `backend/server.py` decides whether an incoming item is a repeat of one already in that store,
in which case it overwrites that row (keeping one row in `items`, with the old price kept in `price_history`)
instead of inserting a new one:

1. **With an `item_code`**: an exact match on `item_code` within the store. This is the reliable case.
2. **With no code** (most stores print one, the ones that don't are listed below): a fuzzy match on name
   (`difflib.SequenceMatcher`, `DUPLICATE_NAME_SIMILARITY = 0.9` in `server.py`), tolerant of OCR noise (a dropped
   or swapped letter) but not much more, **and** the same size (`_same_sizes`, 2% tolerance), so a 12 pack and a 24
   pack with a near-identical name stay two rows. A by-weight item has no size on either side, so it matches on name
   alone. Brand is deliberately **not** checked. Since the name is now always the receipt's own text (see above),
   two genuinely different products should differ in their printed name reliably enough. The known accepted risk
   is a false positive: two different products of the same size at the same codeless store with a near-identical
   printed name would merge. The other side of it: a saved row with no size (some imported rows) is never matched
   by a sized receipt item, and a mistyped size on a repeat purchase makes a new row instead of a 422.
3. A gas item (`fuel_type` set) is never matched this way, every fill-up is deliberately its own row.

**Stores known to print no item code** (everything there goes through the name match in point 2): Bulk Barn, Bulk
Barrel, Shoppers, Amazon, Fresco. Sobeys and Sunripe have had no code on any saved item so far, but that is only a few
items each, so they aren't confirmed. Add a store here when you find one.

### Size typo check

When `POST /api/items` finds a repeat to overwrite, it compares the price per unit (per gram, else per ml, else per
item, whichever both have) against the saved row. The price comes off the receipt, so a price per unit that is more
than `MAX_UNIT_PRICE_SWING = 5` times higher or lower means the typed size or unit is wrong (500 kg for 500 g), and
the item is rejected with a 422 instead of overwriting. A different pack size at a matching price passes. It doesn't
cover a first purchase (nothing saved to compare to), dose, brand or names, or other stores. If the saved size is the
wrong one, a correct entry gets blocked until the saved row is fixed or deleted.

## Item name vs. brand text

The Item column shows a name exactly as saved, nothing is hidden or cut from it. The
frontend used to cut the brand off the front of the name (`stripBrandPrefix`), which turned
`Sprite zero sugar` into `Zero Sugar` and `Quest Bar` into `Bar`, so that was removed.

So a brand that's in the name shows twice, in the Item column and in the Brand column
(`Villagio Hamburger Buns` with brand `Villagio`). That's fine, and it's the right call when
the brand is what the product is called (`Sprite`, `Quest Bar`, `Prime Hydration`,
`Pringles Chips`). A name that is only the brand (`Pringles`) shows as `Pringles`.

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
in the Unit price column. The API ignores it and works the comparison out itself, except
for a typed weight rate (`($7.72 per kg)`) on an item with no size, which `/api/cheapest`
compares on (`WEIGHT_RATE` in `backend/server.py`). The
review page also generates one automatically for a by-weight item with no fixed size
(produce, a bulk bin): its own "Priced by weight" table saves the typed rate as
`($7.72 per kg)`, letting `POST /api/items` accept the item with no `item_count`,
`weight_g` or `volume_ml` at all (see `repo.md`'s Review page rules). The conventions
used when filling these in by hand:

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
  It's optional, set by the review page's "Amount per unit" calculator (mg or g, converted to mg; g x1000).
- A dose given in **IU** (International Units: Vitamin D, A, E and others) has no weight equivalent, so it's never
  stored in `dose_mg`. It stays part of the item name instead, e.g. `Vitamin D3 1000 IU`, same as before this
  column existed.
- Leave `dose_mg` empty for anything that isn't sold by capsule/tablet. It has no relationship to `weight_g`
  (`weight_g` is the whole pack's total, `dose_mg` is per single unit), both can be set on the same item.
- `items.unit_volume_ml` is the same idea for drinks: the volume of a single can or bottle, in ml, set by the same
  "Amount per unit" calculator when its unit is ml or L (L x1000). Leave it empty for anything that isn't sold as
  cans or bottles. It's saved for the record only, no table shows it and no unit price uses it yet.

## Spelling

Typos in imported item names (e.g. "Camoille" for Chamomile, "Vineagar") are generally
left as typed. `/api/cheapest` matches items fuzzily (`SIMILARITY = 0.85` in
`backend/server.py`), so small spelling differences don't break comparisons across
stores. Only fix a typo when it's explicitly flagged, don't go hunting for them.
