"""POST /api/items and GET /api/stores."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient


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


def test_items_without_a_code_are_never_overwritten(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item()
    add_item()

    assert len(stores_in(client)[0]["items"]) == 2
