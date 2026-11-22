"""GET /api/stores says, for each item, whether another store sells the same item for less."""

from collections.abc import Callable
from contextlib import closing

from fastapi.testclient import TestClient

import db


def standings(client: TestClient, country: str = "CA") -> dict[str, list[tuple[bool, dict | None]]]:
    """Each store's items as (is_cheapest, cheaper_at), in the order the API sends them."""
    stores = client.get("/api/stores", params={"country": country}).json()
    return {
        store["name"]: [(item["is_cheapest"], item["cheaper_at"]) for item in store["items"]] for store in stores
    }


def add_with_only_receipt_text(store: str, name: str, price_cents: int, brand: str) -> None:
    """An item saved from a receipt before display names existed: it has an item code and no display name."""
    with closing(db.connect()) as conn, conn:
        conn.execute("INSERT OR IGNORE INTO stores (name, country) VALUES (?, 'CA')", (store,))
        store_id = conn.execute("SELECT id FROM stores WHERE name = ? AND country = 'CA'", (store,)).fetchone()[0]
        conn.execute(
            "INSERT INTO items (store_id, name, price_cents, item_count, brand, item_code) "
            "VALUES (?, ?, ?, 12, ?, '123')",
            (store_id, name, price_cents, brand),
        )


def test_the_dearer_store_says_where_it_is_cheaper_and_the_cheaper_one_says_it_is_cheapest(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(store="Costco", price_cents=1000, brand="Kirkland")
    add_item(store="Fresco", price_cents=800, brand="Kirkland")

    assert standings(client) == {
        "Costco": [(False, {"store": "Fresco", "percent": 20})],
        "Fresco": [(True, None)],
    }


def test_a_tie_makes_both_cheapest(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=800, brand="Kirkland")
    add_item(store="Fresco", price_cents=800, brand="Kirkland")

    assert standings(client) == {"Costco": [(True, None)], "Fresco": [(True, None)]}


def test_an_item_no_other_store_sells_has_neither(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", brand="Kirkland")

    assert standings(client) == {"Costco": [(False, None)]}


def test_it_points_to_the_cheapest_of_the_other_stores(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1000, brand="Kirkland")
    add_item(store="Fresco", price_cents=900, brand="Kirkland")
    add_item(store="Walmart", price_cents=700, brand="Kirkland")

    assert standings(client)["Costco"] == [(False, {"store": "Walmart", "percent": 30})]


def test_names_match_despite_case_and_a_typo(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", display_name="Turmeric", price_cents=600, brand="Club House")
    add_item(store="Fresco", display_name="tumeric", price_cents=450, brand="Club House")

    assert standings(client)["Costco"] == [(False, {"store": "Fresco", "percent": 25})]


def test_the_same_brand_written_two_ways_matches(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1000, brand="Arm & Hammer")
    add_item(store="Fresco", price_cents=800, brand="Arm&Hammer")

    assert standings(client)["Costco"] == [(False, {"store": "Fresco", "percent": 20})]


def test_a_different_brand_is_a_different_item(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1000, brand="Sunrise Farms")
    add_item(store="Fresco", price_cents=800, brand="Farmripe")

    assert standings(client) == {"Costco": [(False, None)], "Fresco": [(False, None)]}


def test_an_item_with_no_brand_is_never_compared(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1000, brand="No Brand")
    add_item(store="Fresco", price_cents=800, brand="No Brand")
    add_item(store="Walmart", price_cents=800)

    assert standings(client) == {
        "Costco": [(False, None)],
        "Fresco": [(False, None)],
        "Walmart": [(False, None)],
    }


def test_a_different_size_is_a_different_item(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1000, item_count=24, brand="Kirkland")
    add_item(store="Fresco", price_cents=800, item_count=12, brand="Kirkland")

    assert standings(client) == {"Costco": [(False, None)], "Fresco": [(False, None)]}


def test_a_pound_and_454_grams_are_the_same_size(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", display_name="Butter", price_cents=500, item_count=None, weight_g=453.6, brand="Lactantia")
    add_item(store="Fresco", display_name="Butter", price_cents=450, item_count=None, weight_g=454, brand="Lactantia")

    assert standings(client)["Costco"] == [(False, {"store": "Fresco", "percent": 10})]


def test_prices_more_than_twice_apart_are_not_the_same_item(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1000, brand="Kirkland")
    add_item(store="Fresco", price_cents=400, brand="Kirkland")

    assert standings(client) == {"Costco": [(False, None)], "Fresco": [(False, None)]}


def test_prices_exactly_twice_apart_still_are(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1000, brand="Kirkland")
    add_item(store="Fresco", price_cents=500, brand="Kirkland")

    assert standings(client)["Costco"] == [(False, {"store": "Fresco", "percent": 50})]


def test_an_item_with_only_the_receipts_text_is_never_compared(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(store="Costco", display_name="Eggs", price_cents=1000, brand="Kirkland")
    add_with_only_receipt_text("Fresco", "Eggs", 800, "Kirkland")

    assert standings(client) == {"Costco": [(False, None)], "Fresco": [(False, None)]}


def test_an_imported_item_typed_by_hand_is_compared(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", display_name="Eggs", price_cents=1000, brand="Kirkland")
    with closing(db.connect()) as conn, conn:
        conn.execute("INSERT INTO stores (name, country) VALUES ('Fresco', 'CA')")
        conn.execute(
            "INSERT INTO items (store_id, name, price_cents, item_count, brand) "
            "VALUES ((SELECT id FROM stores WHERE name = 'Fresco'), 'Eggs (12x)', 800, 12, 'Kirkland')"
        )

    assert standings(client) == {
        "Costco": [(False, {"store": "Fresco", "percent": 20})],
        "Fresco": [(True, None)],
    }


def add_second_row(store: str, display_name: str, price_cents: int, brand: str) -> None:
    """A second row for the same item at a store that already has it, straight in so nothing merges the two."""
    with closing(db.connect()) as conn, conn:
        conn.execute(
            "INSERT INTO items (store_id, name, display_name, price_cents, item_count, brand) "
            "VALUES ((SELECT id FROM stores WHERE name = ?), ?, ?, ?, 12, ?)",
            (store, f"{display_name} again", display_name, price_cents, brand),
        )


def test_two_rows_of_one_item_at_the_same_store_are_not_compared_with_each_other(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(store="Costco", display_name="Eggs", price_cents=1000, brand="Kirkland")
    add_second_row("Costco", "Eggs", 800, "Kirkland")

    assert standings(client) == {"Costco": [(False, None), (False, None)]}


def test_a_store_counts_by_its_cheapest_row_of_an_item(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", display_name="Eggs", price_cents=1400, brand="Kirkland")
    add_second_row("Costco", "Eggs", 1850, "Kirkland")
    add_item(store="Fresco", display_name="Eggs", price_cents=1850, brand="Kirkland")

    assert standings(client) == {
        "Costco": [(True, None), (False, None)],  # the dearer row doesn't get called cheapest
        "Fresco": [(False, {"store": "Costco", "percent": 24})],
    }


def test_stores_in_the_other_country_are_not_compared(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1000, brand="Kirkland")
    add_item(store="Costco", country="US", price_cents=800, brand="Kirkland")

    assert standings(client) == {"Costco": [(False, None)]}
