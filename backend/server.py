"""Local API for the price database, serves each country's stores and cheapest items as JSON on port 8021.

Reads backend/data/prices.db and only listens on 127.0.0.1. Run: python backend/server.py
"""

from contextlib import closing
from typing import Literal

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

from db import connect

PORT = 8021  # registered in ~/dotfiles/.claude/PORTS.md

app = FastAPI()


class Item(BaseModel):
    id: int
    name: str
    price_cents: int | None
    rating: int | None
    purchased_on: str | None


class Store(BaseModel):
    id: int
    name: str
    discount_text: str | None
    items: list[Item]


@app.get("/api/stores")
def list_stores(country: Literal["CA", "US"]) -> list[Store]:
    """Every store in a country with its items, in the order they were imported."""
    with closing(connect()) as conn:
        store_rows = conn.execute(
            "SELECT id, name, discount_text FROM stores WHERE country = ? ORDER BY id", (country,)
        ).fetchall()
        item_rows = conn.execute(
            "SELECT i.id, i.store_id, i.name, i.price_cents, i.rating, i.purchased_on "
            "FROM items i JOIN stores s ON s.id = i.store_id WHERE s.country = ? ORDER BY i.id",
            (country,),
        ).fetchall()

    items_by_store: dict[int, list[Item]] = {}
    for id_, store_id, name, price_cents, rating, purchased_on in item_rows:
        items_by_store.setdefault(store_id, []).append(Item(
            id=id_, name=name, price_cents=price_cents, rating=rating, purchased_on=purchased_on,
        ))

    return [
        Store(id=id_, name=name, discount_text=discount_text, items=items_by_store.get(id_, []))
        for id_, name, discount_text in store_rows
    ]


class CheapestItem(BaseModel):
    id: int
    name: str
    price_cents: int
    other_stores: int  # how many other stores sell this exact item, 0 means it was only found here


class CheapestStore(BaseModel):
    id: int
    name: str
    items: list[CheapestItem]


@app.get("/api/cheapest")
def list_cheapest(country: Literal["CA", "US"]) -> list[CheapestStore]:
    """Each store with the items it sells cheapest, matching items by exact name across stores.

    The size is part of the name, so comparing total prices is fair. An item sold at one store only
    counts as cheapest there, ties list it under every tied store, and items with no price are skipped.
    """
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT i.id, i.store_id, s.name, i.name, i.price_cents "
            "FROM items i JOIN stores s ON s.id = i.store_id "
            "WHERE s.country = ? AND i.price_cents IS NOT NULL ORDER BY i.id",
            (country,),
        ).fetchall()

    # Each store's cheapest row per item, keyed by the name with case and spacing ignored
    offers_by_item: dict[str, dict[int, tuple[int, int, str, str, int]]] = {}
    for row in rows:
        _, store_id, _, name, price_cents = row
        offers = offers_by_item.setdefault(" ".join(name.lower().split()), {})
        if store_id not in offers or price_cents < offers[store_id][4]:
            offers[store_id] = row

    cheapest: dict[int, CheapestStore] = {}
    for offers in offers_by_item.values():
        lowest = min(offer[4] for offer in offers.values())
        for item_id, store_id, store_name, name, price_cents in offers.values():
            if price_cents == lowest:
                store = cheapest.setdefault(store_id, CheapestStore(id=store_id, name=store_name, items=[]))
                store.items.append(CheapestItem(
                    id=item_id, name=name, price_cents=price_cents, other_stores=len(offers) - 1,
                ))

    return [cheapest[store_id] for store_id in sorted(cheapest)]


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
