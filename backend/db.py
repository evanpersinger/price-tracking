"""SQLite connection and tables for the price database, backend/data/prices.db unless PRICES_DB says otherwise."""

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("PRICES_DB", Path(__file__).resolve().parent / "data" / "prices.db"))

_SCHEMA = """
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,      -- CA or US, prices are in CAD or USD to match
    discount_text TEXT,
    UNIQUE (name, country)
);

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    name TEXT NOT NULL,
    price_cents INTEGER,        -- empty when the sheet only had a per-kg price in the name
    rating INTEGER,             -- 1-5, only LCBO has these
    item_count INTEGER,         -- how many items are in the pack, e.g. 24 buns
    weight_g REAL,              -- total weight of the pack
    volume_ml REAL,             -- total volume of the pack
    purchased_on TEXT           -- ISO date, empty for rows imported from the sheet
);

-- One row each time an item was bought, kept for good so prices can be tracked over time. A purchase whose date
-- couldn't be read from the receipt, or whose item has no item code (gas aside), isn't recorded here.
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id),
    item_code TEXT,               -- the item's code on the day, copied from items, empty for gas
    price_cents INTEGER NOT NULL,
    purchased_on TEXT NOT NULL    -- ISO date from the receipt
);

CREATE TABLE IF NOT EXISTS student_discounts (
    id INTEGER PRIMARY KEY,
    country TEXT NOT NULL,
    place TEXT NOT NULL,
    discount TEXT,
    days TEXT
);
"""

# Columns added to items after the first version, added to a database that was created without them
_ADDED_ITEM_COLUMNS = {
    "item_count": "INTEGER",
    "weight_g": "REAL",
    "volume_ml": "REAL",
    "brand": "TEXT",
    "item_code": "TEXT",  # the product code the store prints on the receipt line, empty for the imported rows
    "fuel_type": "TEXT",  # what a gas receipt's fuel is, as printed (Unleaded, 87, Diesel), empty for everything else
    "dose_mg": "REAL",  # the dose on a single capsule/tablet, empty for anything not sold that way or dosed in IU
    # What the person called the item when adding it from a receipt, shown instead of name, which is then the
    # receipt's printed text. Every receipt item has both, the imported rows have only a name.
    "display_name": "TEXT",
}


def _add_missing_columns(conn: sqlite3.Connection) -> None:
    existing = {row[1] for row in conn.execute("PRAGMA table_info(items)")}
    for column, column_type in _ADDED_ITEM_COLUMNS.items():
        if column not in existing:
            conn.execute(f"ALTER TABLE items ADD COLUMN {column} {column_type}")

    if "item_code" not in {row[1] for row in conn.execute("PRAGMA table_info(price_history)")}:
        conn.execute("ALTER TABLE price_history ADD COLUMN item_code TEXT")
        # History written before the column existed takes the code its item has now
        conn.execute(
            "UPDATE price_history SET item_code = (SELECT item_code FROM items WHERE items.id = price_history.item_id)"
        )
        conn.commit()  # the caller may close without committing, which would throw the backfill away


def connect() -> sqlite3.Connection:
    """Open the database, creating its folder and tables on first use and adding any missing columns."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(_SCHEMA)
    _add_missing_columns(conn)
    return conn


def log_activity(action: str, **fields: object) -> None:
    """Appends one JSON line to activity.log next to the database: every write an API endpoint makes, so what got
    added or changed where can be reviewed for debugging. Not read by the app itself."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    entry = {"time": datetime.now(timezone.utc).isoformat(timespec="seconds"), "action": action, **fields}
    with (DB_PATH.parent / "activity.log").open("a") as log_file:
        log_file.write(json.dumps(entry) + "\n")
