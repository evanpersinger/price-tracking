"""POST /api/receipt, the status codes. The model is replaced, so Ollama doesn't need to be running."""

import io
import json

import pytest
import requests
from fastapi.testclient import TestClient
from PIL import Image

import db
import server

PNG = {"content-type": "image/png"}


def image_bytes(fmt: str = "PNG", size: tuple[int, int] = (2, 2)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size).save(buffer, fmt)
    return buffer.getvalue()


PNG_BYTES = image_bytes()


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

    response = client.post("/api/receipt", content=PNG_BYTES, headers=PNG)

    assert (response.status_code, response.json()) == (200, receipt)


def test_a_body_that_is_not_jpeg_or_png_is_rejected(client: TestClient) -> None:
    response = client.post("/api/receipt", content=b"hello", headers={"content-type": "text/plain"})

    assert response.status_code == 415


def test_ollama_being_down_is_a_503(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def ollama_down(*_: object) -> dict:
        raise requests.exceptions.ConnectionError

    monkeypatch.setattr(server, "extract_receipt", ollama_down)

    assert client.post("/api/receipt", content=PNG_BYTES, headers=PNG).status_code == 503


def test_an_unreadable_model_reply_is_a_502(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def bad_reply(*_: object) -> dict:
        raise ValueError("not JSON")

    monkeypatch.setattr(server, "extract_receipt", bad_reply)

    assert client.post("/api/receipt", content=PNG_BYTES, headers=PNG).status_code == 502


def test_an_error_body_from_ollama_is_a_502_and_logged(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    ollama_replies(monkeypatch, 200, {"error": "model requires more memory"})

    response = client.post("/api/receipt", content=PNG_BYTES, headers=PNG)

    assert response.status_code == 502
    assert last_logged()["action"] == "receipt_failed"
    assert "model requires more memory" in last_logged()["error"]


def test_ollama_answering_with_an_http_error_is_a_502_not_a_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ollama_replies(monkeypatch, 404, {"error": "model 'gemma4:12b' not found"})

    response = client.post("/api/receipt", content=PNG_BYTES, headers=PNG)

    assert response.status_code == 502
    assert last_logged()["action"] == "receipt_failed"
    assert "not found" in last_logged()["ollama_reply"]


@pytest.mark.parametrize("items", ["[null]", '"none"', '{"a": 1}'])
def test_items_that_are_not_a_list_of_objects_are_a_502_and_logged(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, items: str
) -> None:
    ollama_replies(monkeypatch, 200, {"message": {"content": f'{{"items": {items}}}'}})

    response = client.post("/api/receipt", content=PNG_BYTES, headers=PNG)

    assert response.status_code == 502
    assert last_logged()["action"] == "receipt_failed"


def test_a_second_receipt_while_one_is_being_read_is_a_409(client: TestClient) -> None:
    server.receipt_lock.acquire()
    try:
        response = client.post("/api/receipt", content=PNG_BYTES, headers=PNG)
    finally:
        server.receipt_lock.release()

    assert response.status_code == 409


def test_a_body_labelled_png_that_is_not_an_image_is_a_415(client: TestClient) -> None:
    response = client.post("/api/receipt", content=b"not an image", headers=PNG)

    assert response.status_code == 415
    assert last_logged()["action"] == "receipt_failed"


def test_a_jpeg_labelled_as_png_is_a_415(client: TestClient) -> None:
    response = client.post("/api/receipt", content=image_bytes("JPEG"), headers=PNG)

    assert response.status_code == 415


def test_an_oversized_body_is_a_413_before_it_is_read(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(server, "MAX_RECEIPT_BYTES", 10)

    response = client.post("/api/receipt", content=b"x" * 11, headers=PNG)

    assert response.status_code == 413


def test_a_body_with_too_many_pixels_is_a_413(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(server, "MAX_RECEIPT_PIXELS", 3)

    response = client.post("/api/receipt", content=PNG_BYTES, headers=PNG)  # 2 x 2 = 4 pixels

    assert response.status_code == 413
