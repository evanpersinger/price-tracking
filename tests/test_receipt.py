"""POST /api/receipt, the status codes. The model is replaced, so Ollama doesn't need to be running."""

import pytest
import requests
from fastapi.testclient import TestClient

import extract_receipt
import server

PNG = {"content-type": "image/png"}


def test_the_extracted_receipt_is_returned(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    receipt = {"store": "Costco", "items": []}
    monkeypatch.setattr(server, "extract_receipt", lambda image, media_type: receipt)

    response = client.post("/api/receipt", content=b"image", headers=PNG)

    assert (response.status_code, response.json()) == (200, receipt)


def test_a_body_that_is_not_jpeg_or_png_is_rejected(client: TestClient) -> None:
    response = client.post("/api/receipt", content=b"hello", headers={"content-type": "text/plain"})

    assert response.status_code == 415


def test_ollama_being_down_is_a_503(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def ollama_down(*_: object) -> dict:
        raise requests.exceptions.ConnectionError

    monkeypatch.setattr(server, "extract_receipt", ollama_down)

    assert client.post("/api/receipt", content=b"image", headers=PNG).status_code == 503


def test_an_unreadable_model_reply_is_a_502(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def bad_reply(*_: object) -> dict:
        raise ValueError("not JSON")

    monkeypatch.setattr(server, "extract_receipt", bad_reply)

    assert client.post("/api/receipt", content=b"image", headers=PNG).status_code == 502


def test_a_second_receipt_while_one_is_being_read_is_a_409(client: TestClient) -> None:
    server.receipt_lock.acquire()
    try:
        response = client.post("/api/receipt", content=b"image", headers=PNG)
    finally:
        server.receipt_lock.release()

    assert response.status_code == 409


@pytest.mark.parametrize("reply", ['{"items": [null]}', '{"items": "none"}', '{"items": {"a": 1}}'])
def test_a_model_reply_with_items_that_are_not_a_list_of_objects_is_a_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, reply: str
) -> None:
    monkeypatch.setattr(extract_receipt, "_image_ollama", lambda *_: reply)

    assert client.post("/api/receipt", content=b"image", headers=PNG).status_code == 502


def test_a_model_reply_without_items_is_still_read(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(extract_receipt, "_image_ollama", lambda *_: '{"store": "Costco"}')

    response = client.post("/api/receipt", content=b"image", headers=PNG)

    assert (response.status_code, response.json()["store"]) == (200, "Costco")
