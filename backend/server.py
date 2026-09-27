"""Local API for the price database, serves and adds each country's stores and items as JSON on port 8021.

Reads and writes backend/data/prices.db and only listens on 127.0.0.1. Run: python backend/server.py
"""

import difflib
import math
import re
from contextlib import closing
from datetime import date
from typing import Literal, NamedTuple

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator

from db import connect

PORT = 8021  # registered in ~/dotfiles/.claude/PORTS.md

app = FastAPI()


class Item(BaseModel):
    id: int
    name: str
    price_cents: int | None
    rating: int | None
    item_count: int | None
    weight_g: float | None
    volume_ml: float | None
    purchased_on: str | None
    brand: str | None


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
            "SELECT i.id, i.store_id, i.name, i.price_cents, i.rating, i.item_count, i.weight_g, i.volume_ml, "
            "i.purchased_on, i.brand FROM items i JOIN stores s ON s.id = i.store_id WHERE s.country = ? "
            "ORDER BY i.id",
            (country,),
        ).fetchall()

    items_by_store: dict[int, list[Item]] = {}
    for id_, store_id, name, price_cents, rating, item_count, weight_g, volume_ml, purchased_on, brand in item_rows:
        items_by_store.setdefault(store_id, []).append(Item(
            id=id_, name=name, price_cents=price_cents, rating=rating, item_count=item_count,
            weight_g=weight_g, volume_ml=volume_ml, purchased_on=purchased_on, brand=brand,
        ))

    return [
        Store(id=id_, name=name, discount_text=discount_text, items=items_by_store.get(id_, []))
        for id_, name, discount_text in store_rows
    ]


class NewItem(BaseModel):
    country: Literal["CA", "US"]
    store: str = Field(min_length=1, max_length=100)  # an existing store's name, or a new one to create
    name: str = Field(min_length=1, max_length=200)
    price_cents: int = Field(gt=0)
    item_count: int | None = Field(default=None, gt=0)  # how many items are in the pack, e.g. 24 buns
    weight_g: float | None = Field(default=None, gt=0)  # total weight of the pack
    volume_ml: float | None = Field(default=None, gt=0)  # total volume of the pack
    purchased_on: date | None = None  # today if left out
    brand: str | None = Field(default=None, max_length=100)

    model_config = {"str_strip_whitespace": True}

    @model_validator(mode="after")
    def _needs_a_size(self) -> "NewItem":
        if self.item_count is None and self.weight_g is None and self.volume_ml is None:
            raise ValueError("an item needs a size, give item_count, weight_g or volume_ml")
        return self


class AddedItem(Item):
    store_id: int


@app.post("/api/items", status_code=201)
def add_item(new_item: NewItem) -> AddedItem:
    """Add an item with its price to a store, creating the store if it isn't in that country yet."""
    purchased_on = (new_item.purchased_on or date.today()).isoformat()
    with closing(connect()) as conn, conn:
        store = conn.execute(
            "SELECT id FROM stores WHERE country = ? AND lower(name) = lower(?)", (new_item.country, new_item.store)
        ).fetchone()
        store_id = store[0] if store else conn.execute(
            "INSERT INTO stores (name, country) VALUES (?, ?)", (new_item.store, new_item.country)
        ).lastrowid
        item_id = conn.execute(
            "INSERT INTO items (store_id, name, price_cents, item_count, weight_g, volume_ml, purchased_on, brand) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (store_id, new_item.name, new_item.price_cents, new_item.item_count, new_item.weight_g,
             new_item.volume_ml, purchased_on, new_item.brand),
        ).lastrowid

    return AddedItem(
        id=item_id, store_id=store_id, name=new_item.name, price_cents=new_item.price_cents, rating=None,
        item_count=new_item.item_count, weight_g=new_item.weight_g, volume_ml=new_item.volume_ml,
        purchased_on=purchased_on, brand=new_item.brand,
    )


# Item matching
UNIT_PRICE = re.compile(r"\([^()]*\$[^()]*\)")  # e.g. "($0.57 per pill)", worked out from the price
AMOUNT = re.compile(r"\(\s*(\d+(?:\.\d+)?)\s*([a-z]+)\s*\)")  # a bracket that is just a number and a unit
SIMILARITY = 0.85  # how alike two names' words must be to count as the same item, 1.0 is identical
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


def _make_offers(rows: list[tuple]) -> list[Offer]:
    """Offers from (id, store id, store name, name, price_cents, item_count, weight_g, volume_ml) rows.

    The size typed into item_count, weight_g and volume_ml wins, the size written in the name is only used when
    those are all empty.
    """
    offers = []
    for item_id, store_id, store_name, name, price_cents, item_count, weight_g, volume_ml in rows:
        words, amounts = _split_name(name)
        typed = {
            kind: amount
            for kind, amount in (("count", item_count), ("weight", weight_g), ("volume", volume_ml))
            if amount
        }
        offers.append(Offer(
            item_id, store_id, store_name, name, price_cents, words, typed or amounts, item_count, weight_g, volume_ml,
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


class CheapestItem(BaseModel):
    id: int
    name: str
    price_cents: int
    other_stores: int  # how many other stores sell this item, 0 means it was only found here
    unit: Literal["each", "g", "ml"]  # what unit_price_cents is per
    unit_price_cents: float
    item_count: int | None
    weight_g: float | None
    volume_ml: float | None


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
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT i.id, i.store_id, s.name, i.name, i.price_cents, i.item_count, i.weight_g, i.volume_ml "
            "FROM items i JOIN stores s ON s.id = i.store_id "
            "WHERE s.country = ? AND i.price_cents IS NOT NULL ORDER BY i.id",
            (country,),
        ).fetchall()

    cheapest: dict[int, CheapestStore] = {}
    for group in _group_items([offer for offer in _make_offers(rows) if offer.amounts]):
        for winner in _pick_winners(group):
            offer = winner.offer
            store = cheapest.setdefault(offer.store_id, CheapestStore(id=offer.store_id, name=offer.store_name, items=[]))
            store.items.append(CheapestItem(
                id=offer.id, name=offer.name, price_cents=offer.price_cents, other_stores=winner.other_stores,
                unit=winner.unit, unit_price_cents=round(winner.unit_price_cents, 4),
                item_count=offer.item_count, weight_g=offer.weight_g, volume_ml=offer.volume_ml,
            ))

    for store in cheapest.values():
        store.items.sort(key=lambda item: item.id)  # back into the order they were added
    return [cheapest[store_id] for store_id in sorted(cheapest)]


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
