"""Acceptance: admin panel PIN auth + booked-profiles data exposure.

Covers:
- GET /api/admin/booked-profiles without session -> 401
- POST /api/admin/login with wrong PIN -> 401, no cookie set
- POST /api/admin/login with correct PIN -> 200, sets session cookie
- GET /api/admin/booked-profiles with session -> 200, at least one applicant with
  contact, pathway, latest consultation date/time, booking count, and document
  metadata (title/source/status), with no review-status documents remaining.
"""

import os

import httpx

from tests.conftest import api_url

ADMIN_PIN = os.environ.get("ADMIN_PIN", "4826")


def test_booked_profiles_requires_session(client: httpx.Client):
    response = client.get("/admin/booked-profiles")
    assert response.status_code == 401
    assert "detail" in response.json()


def test_login_rejects_wrong_pin(client: httpx.Client):
    response = client.post("/admin/login", json={"pin": "0000"})
    assert response.status_code == 401
    assert "educaro_admin_session" not in response.cookies


def test_login_and_booked_profiles_expose_contact_pathway_consultation_and_documents():
    # The login cookie is set with Secure (since APP_URL is https in this env), so a
    # plain http://localhost httpx cookie-jar won't re-attach it automatically like a
    # browser would over https. Extract the raw cookie value from Set-Cookie and send
    # it back explicitly to exercise the exact same session-cookie auth path.
    with httpx.Client(base_url=api_url(), timeout=30.0) as session_client:
        login_response = session_client.post("/admin/login", json={"pin": ADMIN_PIN})
        assert login_response.status_code == 200
        assert login_response.json()["authenticated"] is True
        raw_cookie = login_response.headers.get("set-cookie", "")
        assert "educaro_admin_session=" in raw_cookie
        session_token = raw_cookie.split("educaro_admin_session=", 1)[1].split(";", 1)[0]

        profiles_response = session_client.get(
            "/admin/booked-profiles",
            cookies={"educaro_admin_session": session_token},
        )
        assert profiles_response.status_code == 200
        profiles = profiles_response.json()
        assert len(profiles) >= 1

        record = profiles[0]
        applicant = record["applicant"]
        consultation = record["latest_consultation"]

        # contact + pathway present
        assert applicant["email"]
        assert applicant["pathway"] in {"study", "vocational", "employment"}

        # latest preferred consultation date/time + booking count present
        assert consultation["preferred_date"]
        assert consultation["preferred_time"]
        assert record["consultation_count"] >= 1

        # document metadata: title/source/status, no review-status docs remain
        assert isinstance(applicant["documents"], list)
        for document in applicant["documents"]:
            assert document["title"]
            assert document["source"] in {"applicant-provided", "agent-generated"}
            assert document["status"] != "review"

        logout_response = session_client.post(
            "/admin/logout", cookies={"educaro_admin_session": session_token}
        )
        assert logout_response.status_code == 200
        assert logout_response.json()["authenticated"] is False

        post_logout_response = session_client.get("/admin/booked-profiles")
        assert post_logout_response.status_code == 401
