"""Local API for the price database, serves and adds each country's stores and items as JSON on port 8021.

Reads and writes backend/data/prices.db and only listens on 127.0.0.1. Run: python backend/server.py
"""

import asyncio
import difflib
import logging
import math
import re
import threading
from contextlib import closing
from datetime import date
from typing import Literal, NamedTuple

import requests
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator

from db import connect, log_activity
from extract_receipt import extract_receipt

PORT = 8021  # registered in ~/dotfiles/.claude/PORTS.md
RECEIPT_MEDIA_TYPES = {"image/jpeg", "image/png"}
MAX_RECEIPT_BYTES = 10 * 1024 * 1024

logger = logging.getLogger("uvicorn.error")
receipt_lock = threading.Lock()  # one receipt at a time, the local model is heavy

app = FastAPI()


class Item(BaseModel):
    id: int
    name: str  # the receipt's printed text for an item added from a receipt
    display_name: str | None  # what it is called on screen, empty for the imported items, which show their name
    price_cents: int | None
    rating: int | None
    item_count: int | None
    weight_g: float | None
    volume_ml: float | None
    purchased_on: str | None
    brand: str | None
    item_code: str | None
    fuel_type: str | None  # what the fuel is on a gas receipt, as printed, empty for everything else
    dose_mg: float | None  # the dose on a single capsule/tablet, empty for anything not sold that way or dosed in IU


class Store(BaseModel):
    id: int
    name: str
    discount_text: str | None
    items: list[Item]


@app.get("/api/stores")
def list_stores(country: Literal["CA", "US"]) -> list[Store]:
    """Every store in a country with its items, in the order they were added."""
    with closing(connect()) as conn:
        store_rows = conn.execute(
            "SELECT id, name, discount_text FROM stores WHERE country = ? ORDER BY id", (country,)
        ).fetchall()
        item_rows = conn.execute(
            "SELECT i.id, i.store_id, i.name, i.display_name, i.price_cents, i.rating, i.item_count, i.weight_g, "
            "i.volume_ml, i.purchased_on, i.brand, i.item_code, i.fuel_type, i.dose_mg FROM items i "
            "JOIN stores s ON s.id = i.store_id WHERE s.country = ? ORDER BY i.id",
            (country,),
        ).fetchall()

    items_by_store: dict[int, list[Item]] = {}
    for (id_, store_id, name, display_name, price_cents, rating, item_count, weight_g, volume_ml, purchased_on, brand,
         item_code, fuel_type, dose_mg) in item_rows:
        items_by_store.setdefault(store_id, []).append(Item(
            id=id_, name=name, display_name=display_name, price_cents=price_cents, rating=rating,
            item_count=item_count, weight_g=weight_g, volume_ml=volume_ml, purchased_on=purchased_on, brand=brand,
            item_code=item_code, fuel_type=fuel_type, dose_mg=dose_mg,
        ))

    return [
        Store(id=id_, name=name, discount_text=discount_text, items=items_by_store.get(id_, []))
        for id_, name, discount_text in store_rows
    ]


class NewItem(BaseModel):
    country: Literal["CA", "US"]
    store: str = Field(min_length=1, max_length=100)  # an existing store's name, or a new one to create
    name: str = Field(min_length=1, max_length=200)  # the receipt's printed text
    # What the person calls it, always given: every display name is saved paired with the receipt name it came from
    display_name: str = Field(min_length=1, max_length=200)
    price_cents: int = Field(gt=0)
    item_count: int | None = Field(default=None, gt=0)  # how many items are in the pack, e.g. 24 buns
    weight_g: float | None = Field(default=None, gt=0)  # total weight of the pack
    volume_ml: float | None = Field(default=None, gt=0)  # total volume of the pack
    purchased_on: date | None = None  # from the receipt, left out when it couldn't be read, then no history is recorded
    # (no history either without an item_code, except for gas)
    brand: str | None = Field(default=None, max_length=100)
    item_code: str | None = Field(default=None, max_length=40)  # the store's product code from the receipt line
    fuel_type: str | None = Field(default=None, max_length=40)  # what the fuel is on a gas receipt, as printed
    dose_mg: float | None = Field(default=None, gt=0)  # the dose on a single capsule/tablet, empty when not applicable

    model_config = {"str_strip_whitespace": True}

    @model_validator(mode="after")
    def _needs_a_size(self) -> "NewItem":
        has_size = self.item_count is not None or self.weight_g is not None or self.volume_ml is not None
        # A by-weight item (produce, a bulk bin) has no fixed size at all, the rate is typed into the name
        # instead, same convention ByWeightTable already reads for display (see UNIT_PRICE below).
        if not has_size and not UNIT_PRICE.search(self.name):
            raise ValueError(
                'an item needs a size (item_count, weight_g or volume_ml), or a typed unit price like '
                '"($7.72 per kg)" in the name for a by-weight item with no fixed size'
            )
        return self


class AddedItem(Item):
    store_id: int


@app.post("/api/items", status_code=201)
def add_item(new_item: NewItem) -> AddedItem:
    """Add an item with its price to a store, creating the store if it isn't in that country yet.

    A purchase date is only saved when the receipt gave one, a guess like today's date would corrupt the price
    history. With a date and an item code (or a fuel type, gas has no code), the price is also recorded in
    price_history, even when an existing item is overwritten. Any other item is saved but not tracked.
    """
    purchased_on = new_item.purchased_on.isoformat() if new_item.purchased_on else None
    with closing(connect()) as conn, conn:
        store = conn.execute(
            "SELECT id FROM stores WHERE country = ? AND lower(name) = lower(?)", (new_item.country, new_item.store)
        ).fetchone()
        store_id = store[0] if store else conn.execute(
            "INSERT INTO stores (name, country) VALUES (?, ?)", (new_item.store, new_item.country)
        ).lastrowid
        # Capitals don't matter in a brand, so one that matches a saved brand ignoring case takes the saved spelling
        # (the first one saved wins), keeping Arm&Hammer and arm&hammer as one brand
        brand = new_item.brand
        if brand:
            brand = next(
                (saved for (saved,) in conn.execute("SELECT brand FROM items WHERE brand IS NOT NULL ORDER BY id")
                 if saved.casefold() == brand.casefold()),
                brand,
            )
        values = (new_item.name, new_item.display_name, new_item.price_cents, new_item.item_count, new_item.weight_g,
                  new_item.volume_ml, purchased_on, brand, new_item.item_code, new_item.fuel_type, new_item.dose_mg)
        existing_columns = (
            "id, name, display_name, price_cents, item_count, weight_g, volume_ml, brand, fuel_type, dose_mg"
        )
        if new_item.item_code:
            # A code the store already has means the same product at a new price, so overwrite that row
            existing = conn.execute(
                f"SELECT {existing_columns} FROM items WHERE store_id = ? AND item_code = ?",
                (store_id, new_item.item_code),
            ).fetchone()
        elif new_item.fuel_type:
            # No code on a gas receipt by design, every fill-up is its own row even if the grade repeats
            existing = None
        else:
            # No code to go by (the receipt reader missed it, or this store never prints one): the name is always
            # the receipt's own printed text now (see ReceiptReview's toRow), not a reworded or generalized one, so
            # a near-identical name at this store (tolerating OCR noise, not requiring an exact match) is enough on
            # its own to mean a repeat of the same product.
            candidates = conn.execute(
                f"SELECT {existing_columns} FROM items WHERE store_id = ?", (store_id,)
            ).fetchall()
            # Strip the typed unit price (e.g. "($2.00 per kg)") before comparing: for a by-weight item it's the
            # only thing that changes between purchases, and a big swing in it shouldn't make the same product
            # look like a different one.
            new_name = UNIT_PRICE.sub(" ", new_item.name).lower()
            existing = next(
                (row for row in candidates
                 if difflib.SequenceMatcher(None, new_name, UNIT_PRICE.sub(" ", row[1]).lower()).ratio()
                 >= DUPLICATE_NAME_SIMILARITY),
                None,
            )
        if existing:
            item_id = existing[0]
            conn.execute(
                "UPDATE items SET name = ?, display_name = ?, price_cents = ?, item_count = ?, weight_g = ?, "
                "volume_ml = ?, purchased_on = ?, brand = ?, item_code = ?, fuel_type = ?, dose_mg = ? WHERE id = ?",
                (*values, item_id),
            )
        else:
            item_id = conn.execute(
                "INSERT INTO items (name, display_name, price_cents, item_count, weight_g, volume_ml, purchased_on, "
                "brand, item_code, fuel_type, dose_mg, store_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (*values, store_id),
            ).lastrowid
        # Only an item with a code is tracked (name and price are always there), plus gas, which has none by design
        if purchased_on and (new_item.item_code or new_item.fuel_type):
            conn.execute(
                "INSERT INTO price_history (item_id, item_code, price_cents, purchased_on) VALUES (?, ?, ?, ?)",
                (item_id, new_item.item_code, new_item.price_cents, purchased_on),
            )

    if existing:
        old_fields = dict(zip(
            ("name", "display_name", "price_cents", "item_count", "weight_g", "volume_ml", "brand", "fuel_type",
             "dose_mg"),
            existing[1:],
        ))
        new_fields = {
            "name": new_item.name, "display_name": new_item.display_name, "price_cents": new_item.price_cents,
            "item_count": new_item.item_count, "weight_g": new_item.weight_g, "volume_ml": new_item.volume_ml,
            "brand": brand, "fuel_type": new_item.fuel_type, "dose_mg": new_item.dose_mg,
        }
        changes = {field: {"old": old, "new": new_fields[field]}
                   for field, old in old_fields.items() if old != new_fields[field]}
        log_activity("overwrite", store=new_item.store, country=new_item.country, item_id=item_id,
                      item_code=new_item.item_code, changes=changes)
    else:
        log_activity("insert", store=new_item.store, country=new_item.country, item_id=item_id,
                      name=new_item.name, display_name=new_item.display_name, price_cents=new_item.price_cents,
                      item_count=new_item.item_count, weight_g=new_item.weight_g, volume_ml=new_item.volume_ml, brand=brand,
                      item_code=new_item.item_code, fuel_type=new_item.fuel_type, dose_mg=new_item.dose_mg)

    return AddedItem(
        id=item_id, store_id=store_id, name=new_item.name, display_name=new_item.display_name,
        price_cents=new_item.price_cents, rating=None, item_count=new_item.item_count, weight_g=new_item.weight_g,
        volume_ml=new_item.volume_ml, purchased_on=purchased_on, brand=brand, item_code=new_item.item_code, fuel_type=new_item.fuel_type,
        dose_mg=new_item.dose_mg,
    )


@app.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: int) -> None:
    """Delete an item and its price history, e.g. one added by mistake."""
    with closing(connect()) as conn, conn:
        item = conn.execute(
            "SELECT i.name, i.price_cents, s.name FROM items i JOIN stores s ON s.id = i.store_id WHERE i.id = ?",
            (item_id,),
        ).fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="No item with that id.")
        conn.execute("DELETE FROM price_history WHERE item_id = ?", (item_id,))
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))

    name, price_cents, store = item
    log_activity("delete", item_id=item_id, name=name, price_cents=price_cents, store=store)


@app.post("/api/receipt")
async def read_receipt(request: Request) -> dict:
    """Read a receipt image (the raw JPEG or PNG as the request body) and return the items found on it.

    Nothing is saved. Only one receipt is read at a time, a second one gets 409 instead of queuing.
    """
    media_type = request.headers.get("content-type", "")
    if media_type not in RECEIPT_MEDIA_TYPES:
        raise HTTPException(status_code=415, detail="Send a JPEG or PNG image.")
    if not receipt_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another receipt is being read, try again in a moment.")
    try:
        image = await request.body()
        if len(image) > MAX_RECEIPT_BYTES:
            raise HTTPException(status_code=413, detail="That image is over 10 MB.")
        result = await asyncio.to_thread(extract_receipt, image, media_type)
        log_activity("receipt_read", store=result.get("store"), purchase_date=result.get("purchase_date"),
                      items=result.get("items"), dropped_items=result.pop("_dropped_items", None),
                      raw_reply=result.pop("_raw_reply", None))
        return result
    except requests.exceptions.RequestException as e:
        logger.warning("Ollama call failed: %s", e)
        raise HTTPException(status_code=503, detail="Couldn't reach the local model. Is Ollama running?") from e
    except ValueError as e:
        logger.warning("Receipt read failed: %s", e)
        raise HTTPException(status_code=502, detail="The model's reply couldn't be read, try again.") from e
    finally:
        receipt_lock.release()


# Item matching
UNIT_PRICE = re.compile(r"\([^()]*\$[^()]*\)")  # e.g. "($0.57 per pill)", worked out from the price
AMOUNT = re.compile(r"\(\s*(\d+(?:\.\d+)?)\s*([a-z]+)\s*\)")  # a bracket that is just a number and a unit
SIMILARITY = 0.85  # how alike two names' words must be to count as the same item, 1.0 is identical
# A stricter bar than SIMILARITY above: this one decides whether a new item overwrites an existing row (so a
# false match loses data) rather than just grouping two offers for display, and it's paired with an exact size
# match (see add_item), so this only needs to tolerate OCR noise, not genuinely different wording.
DUPLICATE_NAME_SIMILARITY = 0.9
SIZE_TOLERANCE = 0.02  # 1lb (453.6g) and 454g are the same amount
WEIGHT_G = {"g": 1, "kg": 1000, "lb": 453.592, "lbs": 453.592, "oz": 28.3495}
VOLUME_ML = {"ml": 1, "l": 1000, "lt": 1000}
FLUID_OZ_ML = 29.5735
PER_UNIT = {"count": "each", "weight": "g", "volume": "ml"}  # what offers are compared on, in order of preference


class Offer(NamedTuple):
    id: int
    store_id: int
    store_name: str
    name: str
    price_cents: int
    words: str  # the name without its sizes, lowercase
    amounts: dict[str, float]  # count, weight in g and volume in ml, whichever the item has, empty if none
    item_count: int | None  # the sizes as typed into the add form, passed on so the UI can show them
    weight_g: float | None
    volume_ml: float | None
    brand: str | None
    item_code: str | None
    dose_mg: float | None
    display_name: str | None


class Winner(NamedTuple):
    offer: Offer
    other_stores: int
    unit: str
    unit_price_cents: float


def _to_amount(number: float, unit: str, has_volume: bool) -> tuple[str, float] | None:
    """(kind, amount) for a number and unit, weights in grams and volumes in ml, None for any other unit."""
    if unit == "x":
        return "count", number
    if unit == "oz" and has_volume:  # "(709ml) (24oz)", the oz is fluid ounces
        return "volume", number * FLUID_OZ_ML
    if unit in WEIGHT_G:
        return "weight", number * WEIGHT_G[unit]
    if unit in VOLUME_ML:
        return "volume", number * VOLUME_ML[unit]
    return None


def _split_name(name: str) -> tuple[str, dict[str, float]]:
    """A name's words and the amounts written in it, ignoring case and the typed unit price.

    A bracket that isn't a plain number and unit, like "(250mg per)", stays in the words.
    """
    text = UNIT_PRICE.sub(" ", name).lower()
    matches = list(AMOUNT.finditer(text))
    has_volume = any(match.group(2) in VOLUME_ML for match in matches)

    amounts: dict[str, float] = {}
    for match in matches:
        found = _to_amount(float(match.group(1)), match.group(2), has_volume)
        if found:
            amounts.setdefault(*found)  # an amount written twice, like (454g) (1lb), keeps the first
            text = text.replace(match.group(0), " ", 1)
    return " ".join(text.split()), amounts


def _effective_amounts(
    item_count: int | None, weight_g: float | None, volume_ml: float | None, text_amounts: dict[str, float]
) -> dict[str, float]:
    """The size typed into item_count/weight_g/volume_ml, or the size written in the name when those are all empty."""
    typed = {
        kind: amount
        for kind, amount in (("count", item_count), ("weight", weight_g), ("volume", volume_ml))
        if amount
    }
    return typed or text_amounts


def _make_offers(rows: list[tuple]) -> list[Offer]:
    """Offers from (id, store id, store name, name, price_cents, item_count, weight_g, volume_ml, brand, item_code,
    dose_mg, display_name) rows."""
    offers = []
    for (item_id, store_id, store_name, name, price_cents, item_count, weight_g, volume_ml, brand, item_code,
         dose_mg, display_name) in rows:
        words, text_amounts = _split_name(name)
        amounts = _effective_amounts(item_count, weight_g, volume_ml, text_amounts)
        offers.append(Offer(
            item_id, store_id, store_name, name, price_cents, words, amounts, item_count, weight_g,
            volume_ml, brand, item_code, dose_mg, display_name,
        ))
    return offers


def _same_sizes(a: dict[str, float], b: dict[str, float]) -> bool:
    return a.keys() == b.keys() and all(abs(a[kind] - b[kind]) <= SIZE_TOLERANCE * max(a[kind], b[kind]) for kind in a)


def _group_items(offers: list[Offer]) -> list[list[Offer]]:
    """Group offers into items by their words, keeping only the cheapest offer per store and size."""
    groups: list[list[Offer]] = []
    for offer in offers:
        group = next(
            (g for g in groups if difflib.SequenceMatcher(None, offer.words, g[0].words).ratio() >= SIMILARITY),
            None,
        )
        if group is None:
            groups.append([offer])
            continue

        same = next(
            (i for i, other in enumerate(group)
             if other.store_id == offer.store_id and _same_sizes(other.amounts, offer.amounts)),
            None,
        )
        if same is None:
            group.append(offer)
        elif offer.price_cents < group[same].price_cents:
            group[same] = offer
    return groups


def _own_unit(offer: Offer) -> tuple[str, float]:
    """An offer's unit and its price per that unit, from whichever of count, weight or volume it has."""
    kind = next(kind for kind in PER_UNIT if kind in offer.amounts)
    return PER_UNIT[kind], offer.price_cents / offer.amounts[kind]


def _pick_winners(group: list[Offer]) -> list[Winner]:
    """The cheapest offers for one item.

    Offers are compared on price per item when they have a count, otherwise per gram, then per ml. The first of
    those that two or more stores share is used, and an offer that can't be compared that way is kept as the only
    one of its kind.
    """
    for kind, unit in PER_UNIT.items():
        comparable = [offer for offer in group if kind in offer.amounts]
        if len({offer.store_id for offer in comparable}) < 2:
            continue

        cheapest_per_store: dict[int, tuple[float, Offer]] = {}
        for offer in comparable:
            price = offer.price_cents / offer.amounts[kind]
            if offer.store_id not in cheapest_per_store or price < cheapest_per_store[offer.store_id][0]:
                cheapest_per_store[offer.store_id] = (price, offer)

        lowest = min(price for price, _ in cheapest_per_store.values())
        winners = [
            Winner(offer, len(cheapest_per_store) - 1, unit, price)
            for price, offer in cheapest_per_store.values()
            if math.isclose(price, lowest, rel_tol=1e-9)
        ]
        alone = [Winner(offer, 0, *_own_unit(offer)) for offer in group if kind not in offer.amounts]
        return winners + alone

    return [Winner(offer, 0, *_own_unit(offer)) for offer in group]


def _sized_offers(country: str) -> list[Offer]:
    """Every priced grocery item in a country's stores that has a size, in the order they were added.

    Gas (anything with a fuel_type) is left out, it is compared on its own Gas Prices page and not per item.
    """
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT i.id, i.store_id, s.name, i.name, i.price_cents, i.item_count, i.weight_g, i.volume_ml, i.brand, "
            "i.item_code, i.dose_mg, i.display_name FROM items i JOIN stores s ON s.id = i.store_id "
            "WHERE s.country = ? AND i.price_cents IS NOT NULL AND i.fuel_type IS NULL ORDER BY i.id",
            (country,),
        ).fetchall()
    return [offer for offer in _make_offers(rows) if offer.amounts]


class CheapestItem(BaseModel):
    id: int
    name: str
    display_name: str | None
    price_cents: int
    other_stores: int  # how many other stores sell this item, 0 means it was only found here
    unit: Literal["each", "g", "ml"]  # what unit_price_cents is per
    unit_price_cents: float
    item_count: int | None
    weight_g: float | None
    volume_ml: float | None
    brand: str | None
    item_code: str | None
    dose_mg: float | None


class CheapestStore(BaseModel):
    id: int
    name: str
    items: list[CheapestItem]


@app.get("/api/cheapest")
def list_cheapest(country: Literal["CA", "US"]) -> list[CheapestStore]:
    """Each store with the items it sells cheapest, matching the same item across stores.

    Names match when their words are alike enough, so case, small typos and the typed unit price don't matter.
    Offers are then compared on unit price (per item if there's a count, else per gram, else per ml), so a 24-pack
    and an 8-pack can be compared, and 1lb counts the same as 454g. The size comes from item_count, weight_g and
    volume_ml, or from the name when those are empty. An item sold at one store only counts as cheapest there,
    ties list it under every tied store, and items with no price or no size are left out.
    """
    cheapest: dict[int, CheapestStore] = {}
    for group in _group_items(_sized_offers(country)):
        for winner in _pick_winners(group):
            offer = winner.offer
            store = cheapest.setdefault(offer.store_id, CheapestStore(id=offer.store_id, name=offer.store_name, items=[]))
            store.items.append(CheapestItem(
                id=offer.id, name=offer.name, display_name=offer.display_name, price_cents=offer.price_cents,
                other_stores=winner.other_stores, unit=winner.unit, unit_price_cents=round(winner.unit_price_cents, 4),
                item_count=offer.item_count, weight_g=offer.weight_g, volume_ml=offer.volume_ml, brand=offer.brand,
                item_code=offer.item_code, dose_mg=offer.dose_mg,
            ))

    for store in cheapest.values():
        store.items.sort(key=lambda item: item.id)  # back into the order they were added
    return [cheapest[store_id] for store_id in sorted(cheapest)]


class HistoryEntry(BaseModel):
    id: int
    item_id: int
    store_id: int
    store_name: str
    item_name: str  # the item's name now, an item that was overwritten keeps its history under the newest name
    display_name: str | None  # the item's display name now, empty for an imported item
    item_code: str | None  # the code saved with this purchase, empty for gas
    brand: str | None
    fuel_type: str | None
    item_count: int | None
    weight_g: float | None
    volume_ml: float | None
    price_cents: int  # what it cost on that day
    purchased_on: str


@app.get("/api/history")
def list_history(country: Literal["CA", "US"]) -> list[HistoryEntry]:
    """Every recorded purchase in a country's stores, newest first, from the price_history table."""
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT h.id, h.item_id, s.id, s.name, i.name, i.display_name, h.item_code, i.brand, i.fuel_type, "
            "i.item_count, i.weight_g, i.volume_ml, h.price_cents, h.purchased_on FROM price_history h "
            "JOIN items i ON i.id = h.item_id JOIN stores s ON s.id = i.store_id WHERE s.country = ? "
            "ORDER BY h.purchased_on DESC, h.id DESC",
            (country,),
        ).fetchall()
    return [
        HistoryEntry(
            id=id_, item_id=item_id, store_id=store_id, store_name=store_name, item_name=item_name,
            display_name=display_name, item_code=item_code, brand=brand, fuel_type=fuel_type, item_count=item_count,
            weight_g=weight_g, volume_ml=volume_ml, price_cents=price_cents, purchased_on=purchased_on,
        )
        for (id_, item_id, store_id, store_name, item_name, display_name, item_code, brand, fuel_type, item_count,
             weight_g, volume_ml, price_cents, purchased_on) in rows
    ]


class SearchOffer(BaseModel):
    id: int
    store_id: int
    store_name: str
    name: str
    display_name: str | None
    price_cents: int  # what this store sells it for
    unit_price_cents: float  # per the unit of the list it is in
    item_count: int | None
    weight_g: float | None
    volume_ml: float | None
    brand: str | None
    item_code: str | None
    dose_mg: float | None


class SearchList(BaseModel):
    unit: Literal["each", "g", "ml"]  # what unit_price_cents is per for every offer in this list
    offers: list[SearchOffer]  # cheapest first


def _search_offer(offer: Offer, unit_price_cents: float) -> SearchOffer:
    return SearchOffer(
        id=offer.id, store_id=offer.store_id, store_name=offer.store_name, name=offer.name,
        display_name=offer.display_name, price_cents=offer.price_cents, unit_price_cents=round(unit_price_cents, 4), item_count=offer.item_count,
        weight_g=offer.weight_g, volume_ml=offer.volume_ml, brand=offer.brand, item_code=offer.item_code,
        dose_mg=offer.dose_mg,
    )


@app.get("/api/search")
def search_items(country: Literal["CA", "US"], q: str = Query(min_length=1)) -> list[SearchList]:
    """What every store sells an item for, cheapest first, for every item whose name has all the words in q.

    Offers are ranked on their own unit price, per item if they have a count, else per gram, else per ml. Each unit
    gets its own list because they can't be ranked against each other. A store that has the same item and size more
    than once only counts at its cheapest. Case doesn't matter, and items with no price or no size are left out.
    More optional arguments, like a brand or a store, can be added next to q later.
    """
    terms = q.lower().split()
    if not terms:
        return []

    cheapest_repeat: dict[tuple, Offer] = {}
    for offer in _sized_offers(country):
        if not all(term in offer.words for term in terms):
            continue
        key = (offer.store_id, offer.words, tuple(sorted(offer.amounts.items())))
        if key not in cheapest_repeat or offer.price_cents < cheapest_repeat[key].price_cents:
            cheapest_repeat[key] = offer

    by_unit: dict[str, list[SearchOffer]] = {unit: [] for unit in PER_UNIT.values()}
    for offer in cheapest_repeat.values():
        unit, unit_price_cents = _own_unit(offer)
        by_unit[unit].append(_search_offer(offer, unit_price_cents))
    return [
        SearchList(unit=unit, offers=sorted(offers, key=lambda found: found.unit_price_cents))
        for unit, offers in by_unit.items()
        if offers
    ]


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
