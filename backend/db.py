"""SQLite connection and tables for the price database, backend/data/prices.db unless PRICES_DB says otherwise."""

import json
import logging
import os
import shutil
import sqlite3
import threading
from contextlib import closing
from datetime import UTC, date, datetime
from pathlib import Path

logger = logging.getLogger("uvicorn.error")

MAX_LOG_BYTES = 5 * 1024 * 1024  # activity.log moves to activity.log.1 once it grows past this

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
    "unit_volume_ml": "REAL",  # the volume of a single can or bottle, empty for anything not sold that way
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


_INDEXES = (
    "CREATE INDEX IF NOT EXISTS items_store ON items (store_id)",
    "CREATE INDEX IF NOT EXISTS price_history_item ON price_history (item_id)",
)
# A store has one row per item code. Not created if the database already holds duplicates, see _create_indexes.
_UNIQUE_ITEM_CODE_INDEX = (
    "CREATE UNIQUE INDEX IF NOT EXISTS items_store_code ON items (store_id, item_code) "
    "WHERE item_code IS NOT NULL AND item_code != ''"
)
SCHEMA_VERSION = 1

_ready_paths: set[Path] = set()  # databases whose tables and columns have been set up in this process
_setup_lock = threading.Lock()


def _create_indexes(conn: sqlite3.Connection) -> None:
    for statement in _INDEXES:
        conn.execute(statement)
    try:
        conn.execute(_UNIQUE_ITEM_CODE_INDEX)
    except sqlite3.IntegrityError:
        logger.warning("items has duplicate (store_id, item_code) rows, so the unique index was not created")


def _set_up(conn: sqlite3.Connection) -> None:
    """Create the tables, add missing columns and create indexes, once per database file per process."""
    conn.execute("PRAGMA journal_mode = WAL")  # readers don't block the writer
    conn.executescript(_SCHEMA)
    _add_missing_columns(conn)
    if conn.execute("PRAGMA user_version").fetchone()[0] < SCHEMA_VERSION:
        _create_indexes(conn)
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.commit()


def connect() -> sqlite3.Connection:
    """Open the database, creating its folder and tables on first use and adding any missing columns."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA foreign_keys = ON")
    path = DB_PATH.resolve()
    if path not in _ready_paths:
        with _setup_lock:
            _set_up(conn)
            _ready_paths.add(path)
    return conn


def log_activity(action: str, **fields: object) -> None:
    """Appends one JSON line to activity.log next to the database: every write an API endpoint makes, so what got
    added or changed where can be reviewed for debugging. Not read by the app itself.

    The log holds receipt text and store addresses. It moves to activity.log.1 past MAX_LOG_BYTES, and a failure to
    write it is only warned about, since by now the write it describes has already been saved.
    """
    entry = {"time": datetime.now(UTC).isoformat(timespec="seconds"), "action": action, **fields}
    try:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        log_path = DB_PATH.parent / "activity.log"
        if log_path.exists() and log_path.stat().st_size > MAX_LOG_BYTES:
            log_path.replace(log_path.with_name("activity.log.1"))
        with log_path.open("a") as log_file:
            log_file.write(json.dumps(entry) + "\n")
    except OSError as e:
        logger.warning("Couldn't write to activity.log: %s", e)


def backup_database() -> None:
    """Once a day, on the first server start, copies the database and activity.log into backups/ next to them.

    The copies are named by local date and never deleted. The database goes through sqlite's backup(), which is safe
    with WAL mode on and a request writing at the same moment, a plain file copy is not. Today's database copy is what
    marks the day as done, so it is written last, under a temporary name and then renamed: a failure part way leaves
    no copy of today, and the next start tries again. A failure is only warned about, the server still starts. A
    database that doesn't exist yet has nothing to copy.
    """
    if not DB_PATH.exists():
        return
    today = date.today().isoformat()
    folder = DB_PATH.parent / "backups"
    database_copy = folder / f"prices-{today}.db"
    if database_copy.exists():
        return
    try:
        folder.mkdir(mode=0o700, exist_ok=True)
        log_path = DB_PATH.parent / "activity.log"
        if log_path.exists():
            log_copy = folder / f"activity-{today}.log"
            shutil.copyfile(log_path, log_copy)
            log_copy.chmod(0o600)
        unfinished = folder / f"prices-{today}.db.tmp"
        with closing(sqlite3.connect(DB_PATH, timeout=10)) as source, closing(sqlite3.connect(unfinished)) as target:
            source.backup(target)
        unfinished.chmod(0o600)
        unfinished.replace(database_copy)
    except (OSError, sqlite3.Error) as e:
        logger.warning("Couldn't back up the database: %s", e)
