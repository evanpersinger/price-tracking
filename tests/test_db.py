"""The database setup."""

import sqlite3
from contextlib import closing
from datetime import date

import pytest

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

    assert {"item_count", "weight_g", "volume_ml", "brand", "item_code", "fuel_type", "display_name"} <= columns
    assert rows == [("Rice", 449, None)]


def test_connect_fills_the_item_code_of_history_written_before_the_column_existed() -> None:
    with closing(sqlite3.connect(db.DB_PATH)) as old, old:
        old.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, store_id INTEGER, name TEXT, item_code TEXT)")
        old.execute("INSERT INTO items (store_id, name, item_code) VALUES (1, 'Rice', '123456')")
        old.execute(
            "CREATE TABLE price_history (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL, "
            "price_cents INTEGER NOT NULL, "
            "purchased_on TEXT NOT NULL)"
        )
        old.execute("INSERT INTO price_history (item_id, price_cents, purchased_on) VALUES (1, 449, '2026-09-28')")

    db.connect().close()  # the first connect adds the column, and what it filled in has to survive the close
    with closing(db.connect()) as conn:
        rows = conn.execute("SELECT item_id, item_code, price_cents FROM price_history").fetchall()

    assert rows == [(1, "123456", 449)]


def test_connect_creates_the_indexes_once_and_tracks_them_in_user_version() -> None:
    with closing(db.connect()) as conn:
        indexes = {row[1] for row in conn.execute("PRAGMA index_list(items)")}
        version = conn.execute("PRAGMA user_version").fetchone()[0]

    assert {"items_store", "items_store_code"} <= indexes
    assert version == db.SCHEMA_VERSION


def test_log_activity_survives_an_unwritable_log(monkeypatch, tmp_path) -> None:
    (tmp_path / "blocker").write_text("a file where the folder should be")
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "blocker" / "test.db")

    db.log_activity("insert")  # must not raise


def test_log_activity_moves_a_big_log_aside(monkeypatch) -> None:
    monkeypatch.setattr(db, "MAX_LOG_BYTES", 10)
    db.log_activity("first")
    db.log_activity("second")

    assert "first" in (db.DB_PATH.parent / "activity.log.1").read_text()
    assert "second" in (db.DB_PATH.parent / "activity.log").read_text()


def test_backup_database_copies_the_rows_and_the_activity_log() -> None:
    with closing(db.connect()) as conn, conn:
        conn.execute("INSERT INTO stores (name, country) VALUES ('Costco', 'CA')")
    db.log_activity("receipt_read", store="Costco")

    db.backup_database()

    today = date.today().isoformat()
    backups = db.DB_PATH.parent / "backups"
    with closing(sqlite3.connect(backups / f"prices-{today}.db")) as copy:
        assert copy.execute("SELECT name FROM stores").fetchall() == [("Costco",)]
    assert "receipt_read" in (backups / f"activity-{today}.log").read_text()
    assert not (backups / f"prices-{today}.db.tmp").exists()


def test_backup_database_keeps_the_copies_private() -> None:
    db.connect().close()
    db.log_activity("receipt_read")

    db.backup_database()

    backups = db.DB_PATH.parent / "backups"
    assert backups.stat().st_mode & 0o777 == 0o700
    assert {path.stat().st_mode & 0o777 for path in backups.iterdir()} == {0o600}


def test_backup_database_makes_one_copy_a_day() -> None:
    db.connect().close()
    db.backup_database()
    copy = db.DB_PATH.parent / "backups" / f"prices-{date.today().isoformat()}.db"
    copy.write_text("kept")  # a second backup the same day must leave this alone

    db.backup_database()

    assert copy.read_text() == "kept"


def test_backup_database_does_nothing_without_a_database() -> None:
    db.backup_database()

    assert not (db.DB_PATH.parent / "backups").exists()


def test_backup_database_survives_an_unwritable_backups_folder(caplog: pytest.LogCaptureFixture) -> None:
    db.connect().close()
    (db.DB_PATH.parent / "backups").write_text("a file where the folder should be")

    db.backup_database()  # must not raise

    assert "Couldn't back up the database" in caplog.text
