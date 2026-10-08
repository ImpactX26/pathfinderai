from collections import Counter
from datetime import datetime, timedelta, timezone
import hmac
import os

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.db import db
from models.admin import AdminBookedProfile, AdminLogin, AdminSession
from models.applicant import ApplicantProfile, ConsultationBooking


router = APIRouter(prefix="/admin", tags=["admin"])
COOKIE_NAME = "educaro_admin_session"


def require_admin(request: Request) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    try:
        payload = jwt.decode(
            token,
            os.environ["ADMIN_SESSION_SECRET"],
            algorithms=["HS256"],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Admin session expired") from exc
    if payload.get("sub") != "educaro-admin":
        raise HTTPException(status_code=401, detail="Invalid admin session")


@router.post("/login", response_model=AdminSession)
async def admin_login(input: AdminLogin, response: Response) -> AdminSession:
    expected_pin = os.environ["ADMIN_PIN"]
    if not hmac.compare_digest(input.pin, expected_pin):
        raise HTTPException(status_code=401, detail="Incorrect admin PIN")
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    token = jwt.encode(
        {"sub": "educaro-admin", "exp": expires_at},
        os.environ["ADMIN_SESSION_SECRET"],
        algorithm="HS256",
    )
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=8 * 60 * 60,
        httponly=True,
        secure=os.environ.get("APP_URL", "").startswith("https://"),
        samesite="lax",
        path="/",
    )
    return AdminSession(authenticated=True)


@router.get("/session", response_model=AdminSession)
async def admin_session(request: Request) -> AdminSession:
    try:
        require_admin(request)
    except HTTPException:
        return AdminSession(authenticated=False)
    return AdminSession(authenticated=True)


@router.post("/logout", response_model=AdminSession)
async def admin_logout(response: Response) -> AdminSession:
    response.delete_cookie(COOKIE_NAME, path="/")
    return AdminSession(authenticated=False)


@router.get("/booked-profiles", response_model=list[AdminBookedProfile])
async def booked_profiles(_: None = Depends(require_admin)) -> list[AdminBookedProfile]:
    booking_documents = await db.consultations.find().sort("created_at", -1).to_list(1000)
    booking_counts = Counter(document["applicant_id"] for document in booking_documents)
    seen_applicants: set[str] = set()
    results: list[AdminBookedProfile] = []

    for booking_document in booking_documents:
        applicant_id = booking_document["applicant_id"]
        if applicant_id in seen_applicants:
            continue
        applicant_document = await db.applicant_profiles.find_one({"id": applicant_id})
        if not applicant_document:
            continue
        seen_applicants.add(applicant_id)
        results.append(
            AdminBookedProfile(
                applicant=ApplicantProfile(**applicant_document),
                latest_consultation=ConsultationBooking(**booking_document),
                consultation_count=booking_counts[applicant_id],
            )
        )
    return results