"""Local API for the price database, serves each country's stores and items as JSON on port 8021.

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


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
