"""Import a wide store-prices CSV (one Item/Price column pair per store) into backend/data/prices.db.

Also adds items that appear only in the sheet's hand-made Cheapest Items list. Refuses to run twice for the same
country, so it can't duplicate rows or touch edits made since.
"""

import csv
import sqlite3
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

from db import DB_PATH, connect

COUNTRIES = ("CA", "US")
CHEAPEST_HEADER = "Cheapest Items"
STUDENT_HEADER = "Student Discounts"
NON_STORE_HEADERS = {CHEAPEST_HEADER, "Price", STUDENT_HEADER}  # left-hand blocks, not stores
DISCOUNT_ROW = 1  # discount text sits under each store name
COLUMN_HEADER_ROW = 2  # the Item / Price / Rating labels
FIRST_ITEM_ROW = 3


def _cell(row: list[str], i: int) -> str:
    """Cell i of a row, or empty if the row is shorter, the sheet's rows are ragged."""
    return row[i].strip() if i < len(row) else ""


def _parse_price_cents(text: str) -> int | None:
    """'$4.00' becomes 400, and blank or a bare '$' becomes None."""
    try:
        return round(Decimal(text.replace("$", "").replace(",", "").strip()) * 100)
    except InvalidOperation:
        return None


def _store_blocks(rows: list[list[str]]) -> list[tuple[str, int, int]]:
    """(name, first column, end column) for each store named in the top row."""
    starts = [
        (i, name.strip()) for i, name in enumerate(rows[0])
        if name.strip() and name.strip() not in NON_STORE_HEADERS
    ]
    ends = [i for i, _ in starts[1:]] + [max(len(row) for row in rows)]
    return [(name, start, end) for (start, name), end in zip(starts, ends)]


def _find_col(rows: list[list[str]], start: int, end: int, label: str) -> int | None:
    """Column inside a store's block whose header is label, or None if the store has no such column."""
    return next((i for i in range(start, end) if _cell(rows[COLUMN_HEADER_ROW], i) == label), None)


def _read_store(rows: list[list[str]], start: int, end: int) -> tuple[str | None, list[tuple[str, int | None, int | None]]]:
    """A store's discount text and its (name, price_cents, rating) items."""
    price_col = _find_col(rows, start, end, "Price")
    rating_col = _find_col(rows, start, end, "Rating (1-5)")

    items = []
    for row in rows[FIRST_ITEM_ROW:]:
        name = _cell(row, start)
        if not name:
            continue
        price = _parse_price_cents(_cell(row, price_col)) if price_col is not None else None
        rating_text = _cell(row, rating_col) if rating_col is not None else ""
        items.append((name, price, int(rating_text) if rating_text.isdigit() else None))
    return _cell(rows[DISCOUNT_ROW], start) or None, items


def _read_student_discounts(rows: list[list[str]]) -> list[tuple[str, str | None, str | None]]:
    """(place, discount, days) from the Student Discounts block, which has a blank column after the place."""
    col = next((i for i, name in enumerate(rows[0]) if name.strip() == STUDENT_HEADER), None)
    if col is None:
        return []
    return [
        (_cell(row, col), _cell(row, col + 2) or None, _cell(row, col + 3) or None)
        for row in rows[DISCOUNT_ROW:] if _cell(row, col)
    ]


def _read_cheapest_block(rows: list[list[str]]) -> list[tuple[str, str, int | None]]:
    """(store, name, price_cents) for the Cheapest Items list, where each store's name is a heading above its items."""
    col = next((i for i, name in enumerate(rows[0]) if name.strip() == CHEAPEST_HEADER), None)
    if col is None:
        return []

    store_names = {name for name, _, _ in _store_blocks(rows)}
    store = None
    items = []
    for row in rows[COLUMN_HEADER_ROW:]:
        name = _cell(row, col)
        if name in store_names:
            store = name
        elif name and store:
            items.append((store, name, _parse_price_cents(_cell(row, col + 1))))
    return items


def add_cheapest_block(conn: sqlite3.Connection, rows: list[list[str]], country: str) -> int:
    """Add the Cheapest Items list's items that aren't in the database yet, ignoring case. Returns how many."""
    store_ids = dict(conn.execute("SELECT name, id FROM stores WHERE country = ?", (country,)))
    have = {
        (store_id, name.lower(), price_cents)
        for store_id, name, price_cents in conn.execute(
            "SELECT i.store_id, i.name, i.price_cents FROM items i JOIN stores s ON s.id = i.store_id "
            "WHERE s.country = ?", (country,)
        )
    }

    added = 0
    for store, name, price_cents in _read_cheapest_block(rows):
        store_id = store_ids[store]
        if (store_id, name.lower(), price_cents) in have:
            continue
        conn.execute("INSERT INTO items (store_id, name, price_cents) VALUES (?, ?, ?)", (store_id, name, price_cents))
        have.add((store_id, name.lower(), price_cents))
        added += 1
    return added


def import_sheet(csv_path: Path, country: str) -> None:
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    if len(rows) <= FIRST_ITEM_ROW:
        sys.exit(f"{csv_path.name} doesn't look like the store-prices sheet, expected 3 header rows.")

    with connect() as conn:
        existing = conn.execute("SELECT COUNT(*) FROM stores WHERE country = ?", (country,)).fetchone()[0]
        if existing:
            sys.exit(f"{country} already has {existing} stores in the database, nothing imported.")

        blocks = _store_blocks(rows)
        total_items = total_unpriced = 0
        for name, start, end in blocks:
            discount, items = _read_store(rows, start, end)
            store_id = conn.execute(
                "INSERT INTO stores (name, country, discount_text) VALUES (?, ?, ?)", (name, country, discount)
            ).lastrowid
            conn.executemany(
                "INSERT INTO items (store_id, name, price_cents, rating) VALUES (?, ?, ?, ?)",
                [(store_id, *item) for item in items],
            )

            unpriced = sum(1 for _, price, _ in items if price is None)
            total_items += len(items)
            total_unpriced += unpriced
            print(f"{name}: {len(items)} items, {unpriced} with no price" + (f", discount: {discount}" if discount else ""))

        students = _read_student_discounts(rows)
        conn.executemany(
            "INSERT INTO student_discounts (country, place, discount, days) VALUES (?, ?, ?, ?)",
            [(country, *row) for row in students],
        )
        from_cheapest_list = add_cheapest_block(conn, rows, country)

    print(f"\nImported {len(blocks)} stores, {total_items} items ({total_unpriced} with no price), "
          f"{from_cheapest_list} more items only in the Cheapest Items list and {len(students)} student discounts "
          f"into {DB_PATH}")


if __name__ == "__main__":
    # Usage: python backend/import_sheet.py <csv> <CA|US>
    if len(sys.argv) != 3 or sys.argv[2] not in COUNTRIES:
        sys.exit("Usage: python backend/import_sheet.py <csv> <CA|US>")

    path = Path(sys.argv[1])
    if not path.is_file():
        sys.exit(f"File not found: {path}")
    import_sheet(path, sys.argv[2])
