"""Covers: applicants can remove a review-queue document, and a verified document
(removing both metadata and stored GridFS file)."""
from pathlib import Path
from uuid import uuid4

PDF_BYTES = Path(__file__).parent.joinpath("fixtures", "tscheck-sample.pdf").read_bytes()


def _upload(client, filename: str):
    response = client.post(
        "/applicant/documents/upload",
        data={"kind": "cv"},
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )
    assert response.status_code == 200, response.text
    profile = response.json()
    matches = [d for d in profile["documents"] if d["title"] == filename]
    assert len(matches) == 1
    return matches[0]


def test_remove_review_document(client):
    filename = f"tscheck-removal-review-{uuid4()}.pdf"
    document = _upload(client, filename)
    assert document["status"] == "review"
    document_id = document["id"]

    delete_response = client.delete(f"/applicant/documents/{document_id}")
    assert delete_response.status_code == 200, delete_response.text
    profile_after = delete_response.json()
    remaining = [d for d in profile_after["documents"] if d["id"] == document_id]
    assert remaining == []

    # Confirm it is really gone from the persisted applicant journey, not just the response.
    fresh = client.get("/applicant").json()
    assert all(d["id"] != document_id for d in fresh["documents"])


def _admin_cookie(client) -> dict:
    """Secure cookies set over this env's https-aware server aren't auto-attached by a
    plain http://localhost httpx client, so extract and resend the raw session token."""
    login = client.post("/admin/login", json={"pin": "4826"})
    assert login.status_code == 200, login.text
    raw_cookie = login.headers.get("set-cookie", "")
    assert "educaro_admin_session=" in raw_cookie
    token = raw_cookie.split("educaro_admin_session=", 1)[1].split(";", 1)[0]
    return {"educaro_admin_session": token}


def test_remove_verified_document_deletes_stored_file(client):
    filename = f"tscheck-removal-verified-{uuid4()}.pdf"
    document = _upload(client, filename)
    document_id = document["id"]

    cookies = _admin_cookie(client)

    preview = client.get(f"/admin/documents/{document_id}", cookies=cookies)
    assert preview.status_code == 200, preview.text
    assert preview.headers["content-type"].startswith("application/pdf")

    verified_profile = client.get("/applicant").json()
    verified_document = next(d for d in verified_profile["documents"] if d["id"] == document_id)
    assert verified_document["status"] == "verified"

    delete_response = client.delete(f"/applicant/documents/{document_id}")
    assert delete_response.status_code == 200, delete_response.text
    profile_after = delete_response.json()
    assert all(d["id"] != document_id for d in profile_after["documents"])

    # Stored GridFS bytes must be gone too: an admin re-preview now 404s.
    preview_after_removal = client.get(f"/admin/documents/{document_id}", cookies=cookies)
    assert preview_after_removal.status_code == 404, preview_after_removal.text

    client.post("/admin/logout", cookies=cookies)
