"""Covers: document lifecycle validation - removing an unknown document 404s, admin
preview stays protected without a PIN session, and a valid preview preserves content type."""
from pathlib import Path
from uuid import uuid4

PDF_BYTES = Path(__file__).parent.joinpath("fixtures", "tscheck-sample.pdf").read_bytes()
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def test_remove_unknown_document_returns_404(client):
    response = client.delete(f"/applicant/documents/tscheck-unknown-{uuid4()}")
    assert response.status_code == 404, response.text


def test_admin_preview_requires_pin_session():
    import httpx

    with httpx.Client(base_url="http://localhost:8001/api", timeout=30.0) as anon_client:
        response = anon_client.get(f"/admin/documents/tscheck-nonexistent-{uuid4()}")
        assert response.status_code == 401, response.text


def test_admin_preview_preserves_uploaded_content_type(client):
    filename = f"tscheck-contenttype-{uuid4()}.png"
    upload_response = client.post(
        "/applicant/documents/upload",
        data={"kind": "language"},
        files={"file": (filename, PNG_BYTES, "image/png")},
    )
    assert upload_response.status_code == 200, upload_response.text
    document = next(d for d in upload_response.json()["documents"] if d["title"] == filename)
    document_id = document["id"]

    login = client.post("/admin/login", json={"pin": "4826"})
    assert login.status_code == 200, login.text
    raw_cookie = login.headers.get("set-cookie", "")
    assert "educaro_admin_session=" in raw_cookie
    token = raw_cookie.split("educaro_admin_session=", 1)[1].split(";", 1)[0]
    cookies = {"educaro_admin_session": token}

    preview = client.get(f"/admin/documents/{document_id}", cookies=cookies)
    assert preview.status_code == 200, preview.text
    assert preview.headers["content-type"].startswith("image/png")
    assert preview.content.startswith(b"\x89PNG")

    client.delete(f"/applicant/documents/{document_id}")
    client.post("/admin/logout", cookies=cookies)
