"""POST /api/items and GET /api/stores."""

import json
from collections.abc import Callable
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

import db


def history() -> list[tuple]:
    """Every price_history row as (item id, price in cents, date), oldest first."""
    with closing(db.connect()) as conn:
        return conn.execute("SELECT item_id, price_cents, purchased_on FROM price_history ORDER BY id").fetchall()


def activity_log() -> list[dict]:
    """Every line written to activity.log so far, oldest first."""
    log_path = db.DB_PATH.parent / "activity.log"
    if not log_path.exists():
        return []
    return [json.loads(line) for line in log_path.read_text().splitlines()]


def stores_in(client: TestClient, country: str = "CA") -> list[dict]:
    return client.get("/api/stores", params={"country": country}).json()


def test_adding_an_item_creates_its_store(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", name="Large Eggs", price_cents=1299, brand="Kirkland", item_code="123456")

    [store] = stores_in(client)
    assert store["name"] == "Costco"
    [item] = store["items"]
    assert (item["name"], item["price_cents"], item["brand"], item["item_code"]) == (
        "Large Eggs", 1299, "Kirkland", "123456",
    )


def test_store_name_is_matched_ignoring_case(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco")
    add_item(store="costco", name="Butter")

    [store] = stores_in(client)
    assert len(store["items"]) == 2


def test_stores_are_listed_per_country(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(country="CA", store="Costco")
    add_item(country="US", store="Costco", name="Butter")

    assert [item["name"] for item in stores_in(client, "CA")[0]["items"]] == ["Large Eggs"]
    assert [item["name"] for item in stores_in(client, "US")[0]["items"]] == ["Butter"]


def test_item_without_a_size_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/items", json={"country": "CA", "store": "Costco", "name": "Large Eggs", "price_cents": 500}
    )

    assert response.status_code == 422


@pytest.mark.parametrize("price_cents", [0, -1])
def test_price_under_a_cent_is_rejected(client: TestClient, price_cents: int) -> None:
    response = client.post(
        "/api/items",
        json={"country": "CA", "store": "Costco", "name": "Large Eggs", "price_cents": price_cents, "item_count": 12},
    )

    assert response.status_code == 422


def test_same_item_code_overwrites_the_saved_item(client: TestClient, add_item: Callable[..., dict]) -> None:
    first = add_item(item_code="123456", price_cents=1000)
    second = add_item(item_code="123456", price_cents=1200, name="Large Eggs 12")

    assert second["id"] == first["id"]
    [item] = stores_in(client)[0]["items"]
    assert (item["name"], item["price_cents"]) == ("Large Eggs 12", 1200)


def test_same_item_code_at_another_store_is_a_new_item(add_item: Callable[..., dict]) -> None:
    costco = add_item(store="Costco", item_code="123456")
    fresco = add_item(store="Fresco", item_code="123456")

    assert costco["id"] != fresco["id"]


def test_adding_an_item_logs_an_insert(add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", name="Large Eggs", price_cents=1299, brand="Kirkland")

    [entry] = activity_log()
    assert entry["action"] == "insert"
    assert (entry["store"], entry["name"], entry["price_cents"], entry["brand"]) == (
        "Costco", "Large Eggs", 1299, "Kirkland",
    )


def test_overwriting_an_item_logs_only_the_changed_fields(add_item: Callable[..., dict]) -> None:
    add_item(item_code="123456", price_cents=1000)
    add_item(item_code="123456", price_cents=1200, name="Large Eggs 12")

    [_, overwrite] = activity_log()
    assert overwrite["action"] == "overwrite"
    assert overwrite["changes"] == {
        "name": {"old": "Large Eggs", "new": "Large Eggs 12"},
        "price_cents": {"old": 1000, "new": 1200},
    }


def test_a_brand_in_different_capitals_takes_the_saved_spelling(add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", brand="Arm&Hammer")
    other_store = add_item(store="Fresco", name="Baking Soda", brand="arm&hammer")

    assert other_store["brand"] == "Arm&Hammer"


def test_no_brand_matches_in_any_capitals(add_item: Callable[..., dict]) -> None:
    add_item(brand="No Brand")

    assert add_item(name="Salt", brand="NO BRAND")["brand"] == "No Brand"


def test_a_new_brand_keeps_the_spelling_it_was_typed_with(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(brand="Arm&Hammer")
    add_item(name="Salt", brand="Windsor")

    brands = [item["brand"] for item in stores_in(client)[0]["items"]]
    assert brands == ["Arm&Hammer", "Windsor"]


def test_a_fuel_type_is_saved_and_listed(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(name="Gas", fuel_type="Unleaded", item_count=1, volume_ml=26204)
    add_item(name="Salt")

    fuel, grocery = stores_in(client)[0]["items"]
    assert (fuel["fuel_type"], grocery["fuel_type"]) == ("Unleaded", None)


def test_a_dose_is_saved_and_listed(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(name="Vitamin C", dose_mg=500)
    add_item(name="Salt")

    dosed, undosed = stores_in(client)[0]["items"]
    assert (dosed["dose_mg"], undosed["dose_mg"]) == (500, None)


def test_a_purchase_with_a_date_is_saved_and_recorded_in_the_history(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    item = add_item(price_cents=1299, purchased_on="2026-09-28")

    [saved] = stores_in(client)[0]["items"]
    assert saved["purchased_on"] == "2026-09-28"
    assert history() == [(item["id"], 1299, "2026-09-28")]


def test_a_repeat_purchase_overwrites_the_item_but_keeps_the_old_price_in_the_history(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(item_code="123456", price_cents=1000, purchased_on="2026-09-01")
    add_item(item_code="123456", price_cents=1200, purchased_on="2026-09-20")

    [saved] = stores_in(client)[0]["items"]
    assert saved["price_cents"] == 1200
    assert [(price, day) for _, price, day in history()] == [(1000, "2026-09-01"), (1200, "2026-09-20")]


def test_no_date_is_made_up_and_nothing_goes_in_the_history(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item()

    [saved] = stores_in(client)[0]["items"]
    assert saved["purchased_on"] is None
    assert history() == []


def test_same_name_without_a_code_overwrites_the_saved_item(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    first = add_item(price_cents=1000)
    second = add_item(price_cents=1200)

    assert second["id"] == first["id"]
    assert len(stores_in(client)[0]["items"]) == 1


def test_near_identical_name_without_a_code_still_overwrites_the_saved_item(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    """Tolerates the kind of noise an OCR misread introduces, one dropped letter."""
    first = add_item(name="Chicken Strips")
    second = add_item(name="Chickn Strips")

    assert second["id"] == first["id"]
    assert len(stores_in(client)[0]["items"]) == 1


def test_different_name_without_a_code_is_a_new_item(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(name="Large Eggs")
    add_item(name="Medium Eggs")

    assert len(stores_in(client)[0]["items"]) == 2


def test_a_different_brand_or_size_with_the_same_name_without_a_code_still_overwrites(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    """The name is always the receipt's own printed text (see ReceiptReview's toRow), so it's the only thing that
    needs to match; brand and size no longer factor in."""
    first = add_item(name="Chamomile Tea", brand="Kirkland", item_count=50)
    second = add_item(name="Chamomile Tea", brand="Great Value", item_count=20)

    assert second["id"] == first["id"]
    assert len(stores_in(client)[0]["items"]) == 1


def test_a_repeat_fuel_item_without_a_code_is_never_overwritten(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(name="Gas", fuel_type="Unleaded", item_count=1, volume_ml=26204)
    add_item(name="Gas", fuel_type="Unleaded", item_count=1, volume_ml=30000)

    assert len(stores_in(client)[0]["items"]) == 2
