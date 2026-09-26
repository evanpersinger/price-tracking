"""SQLite connection and tables for the price database, stored in backend/data/prices.db."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "prices.db"

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
    purchased_on TEXT           -- ISO date, empty for rows imported from the sheet
);

CREATE TABLE IF NOT EXISTS student_discounts (
    id INTEGER PRIMARY KEY,
    country TEXT NOT NULL,
    place TEXT NOT NULL,
    discount TEXT,
    days TEXT
);
"""


def connect() -> sqlite3.Connection:
    """Open the database, creating its folder and tables on first use."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(_SCHEMA)
    return conn
