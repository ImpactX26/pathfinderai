"""Covers: an authenticated admin View of a real uploaded document automatically
marks it verified, and a removed document is absent from admin booked-profile data."""
from pathlib import Path
from uuid import uuid4

PDF_BYTES = Path(__file__).parent.joinpath("fixtures", "tscheck-sample.pdf").read_bytes()


def _upload(client, filename: str):
    response = client.post(
        "/applicant/documents/upload",
        data={"kind": "degree"},
        files={"file": (filename, PDF_BYTES, "application/pdf")},
    )
    assert response.status_code == 200, response.text
    profile = response.json()
    return next(d for d in profile["documents"] if d["title"] == filename)


def _admin_cookie(client) -> dict:
    login = client.post("/admin/login", json={"pin": "4826"})
    assert login.status_code == 200, login.text
    raw_cookie = login.headers.get("set-cookie", "")
    assert "educaro_admin_session=" in raw_cookie
    token = raw_cookie.split("educaro_admin_session=", 1)[1].split(";", 1)[0]
    return {"educaro_admin_session": token}


def test_admin_view_marks_document_verified(client):
    filename = f"tscheck-autoverify-{uuid4()}.pdf"
    document = _upload(client, filename)
    document_id = document["id"]
    assert document["status"] == "review"

    cookies = _admin_cookie(client)

    preview = client.get(f"/admin/documents/{document_id}", cookies=cookies)
    assert preview.status_code == 200, preview.text
    assert preview.content.startswith(b"%PDF-")

    next_profile_fetch = client.get("/applicant").json()
    updated_document = next(d for d in next_profile_fetch["documents"] if d["id"] == document_id)
    assert updated_document["status"] == "verified", updated_document

    client.delete(f"/applicant/documents/{document_id}")
    client.post("/admin/logout", cookies=cookies)


def test_removed_document_absent_from_admin_booked_profiles(client):
    filename = f"tscheck-absent-after-removal-{uuid4()}.pdf"
    document = _upload(client, filename)
    document_id = document["id"]

    cookies = _admin_cookie(client)

    # Verify it, then confirm it currently shows up in admin's booked-profile data.
    assert client.get(f"/admin/documents/{document_id}", cookies=cookies).status_code == 200
    booked = client.get("/admin/booked-profiles", cookies=cookies)
    assert booked.status_code == 200, booked.text
    demo_record = next((r for r in booked.json() if r["applicant"]["id"] == "demo-applicant"), None)
    assert demo_record is not None, "demo-applicant must have a booked consultation (seed fact)"
    assert any(d["id"] == document_id for d in demo_record["applicant"]["documents"])

    delete_response = client.delete(f"/applicant/documents/{document_id}")
    assert delete_response.status_code == 200, delete_response.text

    booked_after = client.get("/admin/booked-profiles", cookies=cookies)
    assert booked_after.status_code == 200, booked_after.text
    demo_record_after = next(r for r in booked_after.json() if r["applicant"]["id"] == "demo-applicant")
    assert all(d["id"] != document_id for d in demo_record_after["applicant"]["documents"])

    # And the protected preview endpoint itself must 404 for the removed document.
    assert client.get(f"/admin/documents/{document_id}", cookies=cookies).status_code == 404

    client.post("/admin/logout", cookies=cookies)
