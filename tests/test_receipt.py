"""POST /api/receipt, the status codes. The model is replaced, so Ollama doesn't need to be running."""

import json

import pytest
import requests
from fastapi.testclient import TestClient

import db
import server

PNG = {"content-type": "image/png"}


def ollama_replies(monkeypatch: pytest.MonkeyPatch, status_code: int, body: dict) -> None:
    """Make the call to Ollama come back with this status and JSON body."""
    response = requests.Response()
    response.status_code = status_code
    response._content = json.dumps(body).encode()
    monkeypatch.setattr(requests, "post", lambda *_, **__: response)


def last_logged() -> dict:
    """The newest line in activity.log."""
    return json.loads((db.DB_PATH.parent / "activity.log").read_text().splitlines()[-1])


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


def test_an_error_body_from_ollama_is_a_502_and_logged(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    ollama_replies(monkeypatch, 200, {"error": "model requires more memory"})

    response = client.post("/api/receipt", content=b"image", headers=PNG)

    assert response.status_code == 502
    assert last_logged()["action"] == "receipt_failed"
    assert "model requires more memory" in last_logged()["error"]


def test_ollama_answering_with_an_http_error_is_a_502_not_a_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ollama_replies(monkeypatch, 404, {"error": "model 'gemma4:12b' not found"})

    response = client.post("/api/receipt", content=b"image", headers=PNG)

    assert response.status_code == 502
    assert last_logged()["action"] == "receipt_failed"
    assert "not found" in last_logged()["ollama_reply"]


def test_a_second_receipt_while_one_is_being_read_is_a_409(client: TestClient) -> None:
    server.receipt_lock.acquire()
    try:
        response = client.post("/api/receipt", content=b"image", headers=PNG)
    finally:
        server.receipt_lock.release()

    assert response.status_code == 409
