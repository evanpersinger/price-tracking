"""Shared test setup. Every test gets its own empty database, the real prices.db is never opened."""

from collections.abc import Callable
from contextlib import closing
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import db
import server


@pytest.fixture(autouse=True)
def temp_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")


@pytest.fixture
def client() -> TestClient:
    return TestClient(server.app)


@pytest.fixture
def add_item(client: TestClient) -> Callable[..., dict]:
    """Add an item through POST /api/items, a 12-count Costco item in Canada unless the fields say otherwise."""

    def _add(**fields: object) -> dict:
        body = {
            "country": "CA", "store": "Costco", "name": "Large Eggs", "price_cents": 1000, "item_count": 12, **fields,
        }
        response = client.post("/api/items", json=body)
        assert response.status_code == 201, response.text
        return response.json()

    return _add


@pytest.fixture
def add_imported() -> Callable[..., None]:
    """Insert an item the way the sheet import did: the size is only in the name, the size columns stay empty."""

    def _add(store: str, name: str, price_cents: int, country: str = "CA") -> None:
        with closing(db.connect()) as conn, conn:
            conn.execute("INSERT OR IGNORE INTO stores (name, country) VALUES (?, ?)", (store, country))
            store_id = conn.execute(
                "SELECT id FROM stores WHERE name = ? AND country = ?", (store, country)
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO items (store_id, name, price_cents) VALUES (?, ?, ?)", (store_id, name, price_cents)
            )

    return _add
