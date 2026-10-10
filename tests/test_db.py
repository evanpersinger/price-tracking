"""The database setup."""

import sqlite3
from contextlib import closing

import db


def test_connect_adds_missing_item_columns_and_keeps_the_rows() -> None:
    with closing(sqlite3.connect(db.DB_PATH)) as old, old:
        old.execute(
            "CREATE TABLE items (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL, name TEXT NOT NULL, "
            "price_cents INTEGER, rating INTEGER, purchased_on TEXT)"
        )
        old.execute("INSERT INTO items (store_id, name, price_cents) VALUES (1, 'Rice', 449)")

    with closing(db.connect()) as conn:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(items)")}
        rows = conn.execute("SELECT name, price_cents, brand FROM items").fetchall()

    assert {"item_count", "weight_g", "volume_ml", "brand", "item_code", "fuel_type"} <= columns
    assert rows == [("Rice", 449, None)]


def test_connect_creates_the_price_history_table() -> None:
    with closing(db.connect()) as conn:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(price_history)")}

    assert columns == {"id", "item_id", "item_code", "price_cents", "purchased_on"}


def test_connect_fills_the_item_code_of_history_written_before_the_column_existed() -> None:
    with closing(sqlite3.connect(db.DB_PATH)) as old, old:
        old.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, store_id INTEGER, name TEXT, item_code TEXT)")
        old.execute("INSERT INTO items (store_id, name, item_code) VALUES (1, 'Rice', '123456')")
        old.execute(
            "CREATE TABLE price_history (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL, price_cents INTEGER NOT NULL, "
            "purchased_on TEXT NOT NULL)"
        )
        old.execute("INSERT INTO price_history (item_id, price_cents, purchased_on) VALUES (1, 449, '2026-09-28')")

    db.connect().close()  # the first connect adds the column, and what it filled in has to survive the close
    with closing(db.connect()) as conn:
        rows = conn.execute("SELECT item_id, item_code, price_cents FROM price_history").fetchall()

    assert rows == [(1, "123456", 449)]
