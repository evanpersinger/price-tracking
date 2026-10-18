"""Fill an empty database with made-up prices, so a fresh clone has something to show on every page.

The store names are real but every item, price and date is invented. Refuses to run if the database already has any
stores, so it can't add to or touch real data. Dates count back from today, so the Price Tracking graphs always have
dots in them.
"""

import sqlite3
import sys
from datetime import date, timedelta
from typing import NamedTuple

from db import DB_PATH, connect

COUNTRIES = ("CA", "US")
NO_BRAND = "No Brand"
# (days ago, share of today's price) for each recorded purchase, oldest first, the last one is the current price
PURCHASES = ((300, 0.94), (170, 1.08), (75, 0.97), (12, 1.0))
STAGGER_DAYS = 5  # each item shifts its dates by up to this many days, so the graphs don't all line up


class Product(NamedTuple):
    name: str  # the receipt's printed text
    display_name: str
    brand: str
    prices: dict[str, int]  # price_cents at each store that sells it, or cents per kg when weighed_g is set
    item_count: int | None = None
    weight_g: float | None = None
    volume_ml: float | None = None
    dose_mg: float | None = None
    unit_volume_ml: float | None = None
    item_code: str | None = None  # the same at every store (a produce PLU), else each store gets its own
    weighed_g: float | None = None  # a by-weight item: the amount on the receipt, its per kg rate goes in the name


STORES = {  # name -> discount text
    "CA": {"Costco": "Membership required", "Walmart": None, "Food Basics": None},
    "US": {"Costco": "Membership required", "Walmart": None, "Target": None},
}

PRODUCTS = {
    "CA": [
        Product("2% MILK", "2% Milk", "Neilson", {"Costco": 549, "Walmart": 599, "Food Basics": 579}, volume_ml=4000),
        Product("LARGE EGGS", "Large Eggs", "Burnbrae", {"Costco": 449, "Walmart": 399, "Food Basics": 429},
                item_count=12),
        Product("WHITE BREAD", "White Bread", "Wonder", {"Costco": 349, "Walmart": 329, "Food Basics": 299},
                weight_g=675),
        Product("PEANUT BUTTER", "Peanut Butter", "Kraft", {"Costco": 649, "Walmart": 749, "Food Basics": 729},
                weight_g=1000),
        Product("COCA COLA", "Coca-Cola", "Coca-Cola", {"Costco": 899, "Walmart": 849, "Food Basics": 799},
                item_count=12, volume_ml=4260, unit_volume_ml=355),
        Product("SPAGHETTI", "Spaghetti", "Barilla", {"Costco": 229, "Walmart": 179, "Food Basics": 199},
                weight_g=450),
        Product("BANANAS", "Bananas", NO_BRAND, {"Costco": 154, "Walmart": 174, "Food Basics": 164},
                item_code="4011", weighed_g=1200),
        Product("GRANNY SMITH APPLES", "Granny Smith Apples", NO_BRAND, {"Walmart": 439, "Food Basics": 399},
                item_code="4017", weighed_g=1500),
        Product("BONELESS CHICKEN BREAST", "Boneless Chicken Breast", NO_BRAND,
                {"Costco": 1099, "Walmart": 1299, "Food Basics": 1199}, weighed_g=900),
        Product("KS BATH TISSUE", "Bath Tissue", "Kirkland", {"Costco": 3099}, item_count=30),
        Product("KS OLIVE OIL", "Olive Oil", "Kirkland", {"Costco": 1999}, volume_ml=2000),
        Product("KS ALMONDS", "Almonds", "Kirkland", {"Costco": 1599}, weight_g=1360),
        Product("KS MAGNESIUM", "Magnesium", "Kirkland", {"Costco": 1399}, item_count=200, dose_mg=250),
        Product("GV BUTTER", "Butter", "Great Value", {"Walmart": 549}, weight_g=454),
        Product("NN CHEDDAR", "Cheddar Cheese", "No Name", {"Food Basics": 549}, weight_g=400),
    ],
    "US": [
        Product("2% MILK", "2% Milk", "Organic Valley", {"Costco": 479, "Walmart": 449, "Target": 499},
                volume_ml=1893),
        Product("LARGE EGGS", "Large Eggs", "Eggland's Best", {"Costco": 399, "Walmart": 429, "Target": 449},
                item_count=12),
        Product("WHEAT BREAD", "Wheat Bread", "Dave's Killer Bread", {"Costco": 599, "Walmart": 549, "Target": 529},
                weight_g=765),
        Product("PEANUT BUTTER", "Peanut Butter", "Jif", {"Costco": 699, "Walmart": 729, "Target": 759},
                weight_g=1020),
        Product("COCA COLA", "Coca-Cola", "Coca-Cola", {"Costco": 849, "Walmart": 799, "Target": 769},
                item_count=12, volume_ml=4260, unit_volume_ml=355),
        Product("SPAGHETTI", "Spaghetti", "Barilla", {"Costco": 229, "Walmart": 149, "Target": 139}, weight_g=454),
        Product("BANANAS", "Bananas", NO_BRAND, {"Costco": 131, "Walmart": 143, "Target": 154},
                item_code="4011", weighed_g=1200),
        Product("GRANNY SMITH APPLES", "Granny Smith Apples", NO_BRAND, {"Walmart": 395, "Target": 439},
                item_code="4017", weighed_g=1500),
        Product("BONELESS CHICKEN BREAST", "Boneless Chicken Breast", NO_BRAND,
                {"Costco": 770, "Walmart": 880, "Target": 950}, weighed_g=900),
        Product("KS BATH TISSUE", "Bath Tissue", "Kirkland", {"Costco": 2199}, item_count=30),
        Product("KS OLIVE OIL", "Olive Oil", "Kirkland", {"Costco": 1799}, volume_ml=2000),
        Product("KS ALMONDS", "Almonds", "Kirkland", {"Costco": 1399}, weight_g=1360),
        Product("GV BUTTER", "Butter", "Great Value", {"Walmart": 449}, weight_g=454),
        Product("GG CHEDDAR", "Cheddar Cheese", "Good & Gather", {"Target": 399}, weight_g=340),
    ],
}

# country -> (station, fuel type as the receipt prints it, [(days ago, litres, price per litre)])
GAS = {
    "CA": ("Costco", "Regular", [(290, 38.2, 1.389), (210, 41.0, 1.459), (140, 36.5, 1.519), (70, 40.3, 1.439),
                                 (9, 37.8, 1.479)]),
    "US": ("Costco", "Regular", [(280, 45.0, 0.789), (200, 42.5, 0.829), (130, 44.1, 0.869), (60, 43.2, 0.809),
                                 (6, 41.7, 0.849)]),
}


def _add_item(conn: sqlite3.Connection, store_id: int, **fields: object) -> int:
    """Insert one items row from column=value pairs (column names come from this file, never from input)."""
    columns = ", ".join(fields)
    marks = ", ".join("?" * len(fields))
    return conn.execute(
        f"INSERT INTO items (store_id, {columns}) VALUES (?, {marks})", (store_id, *fields.values())
    ).lastrowid


def _add_purchase(conn: sqlite3.Connection, item_id: int, item_code: str | None, price_cents: int, day: date) -> None:
    conn.execute(
        "INSERT INTO price_history (item_id, item_code, price_cents, purchased_on) VALUES (?, ?, ?, ?)",
        (item_id, item_code, price_cents, day.isoformat()),
    )


def _seed_products(conn: sqlite3.Connection, country: str, store_ids: dict[str, int], today: date) -> None:
    for index, product in enumerate(PRODUCTS[country]):
        for store_number, store in enumerate(store_ids):
            if store not in product.prices:
                continue

            name, price_cents = product.name, product.prices[store]
            if product.weighed_g:
                # The receipt's total is the rate times the weight, and the rate is typed into the name
                name = f"{product.name} (${price_cents / 100:.2f} per kg)"
                price_cents = round(price_cents * product.weighed_g / 1000)
            item_code = product.item_code or str(100000 + 1000 * store_number + index)

            shift = (index + store_number) % STAGGER_DAYS
            history = [
                (today - timedelta(days=days + shift), round(price_cents * share)) for days, share in PURCHASES
            ]
            item_id = _add_item(
                conn, store_ids[store], name=name, display_name=product.display_name, brand=product.brand,
                price_cents=price_cents, purchased_on=history[-1][0].isoformat(), item_code=item_code,
                item_count=product.item_count, weight_g=product.weight_g, volume_ml=product.volume_ml,
                dose_mg=product.dose_mg, unit_volume_ml=product.unit_volume_ml,
            )
            for day, cents in history:
                _add_purchase(conn, item_id, item_code, cents, day)


def _seed_gas(conn: sqlite3.Connection, country: str, store_ids: dict[str, int], today: date) -> None:
    """Every fill-up is its own item row with no item code, like a gas receipt saved through the API."""
    station, fuel_type, fill_ups = GAS[country]
    for days, litres, per_litre in fill_ups:
        day = today - timedelta(days=days)
        price_cents = round(litres * per_litre * 100)
        item_id = _add_item(
            conn, store_ids[station], name="Gas", display_name="Gas", brand=NO_BRAND, price_cents=price_cents,
            purchased_on=day.isoformat(), item_count=1, volume_ml=litres * 1000, fuel_type=fuel_type,
        )
        _add_purchase(conn, item_id, None, price_cents, day)


def seed_demo() -> None:
    today = date.today()
    with connect() as conn:
        existing = conn.execute("SELECT COUNT(*) FROM stores").fetchone()[0]
        if existing:
            sys.exit(
                f"{DB_PATH} already has {existing} stores, nothing added. "
                "Point PRICES_DB at a new file to try the demo data."
            )

        for country in COUNTRIES:
            store_ids = {
                name: conn.execute(
                    "INSERT INTO stores (name, country, discount_text) VALUES (?, ?, ?)", (name, country, discount)
                ).lastrowid
                for name, discount in STORES[country].items()
            }
            _seed_products(conn, country, store_ids, today)
            _seed_gas(conn, country, store_ids, today)

        items = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
        purchases = conn.execute("SELECT COUNT(*) FROM price_history").fetchone()[0]

    print(f"Added demo data to {DB_PATH}: {items} items and {purchases} recorded purchases. All prices are made up.")


if __name__ == "__main__":
    # Usage: python backend/seed_demo.py
    seed_demo()
