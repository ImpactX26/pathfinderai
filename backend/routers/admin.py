from collections import Counter
from datetime import datetime, timedelta, timezone
import hmac
import os

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import Response as FileResponse

from lib.db import db
from lib.documents import document_preview
from models.admin import AdminBookedProfile, AdminDocumentDecision, AdminLogin, AdminSession
from models.applicant import ApplicantDocument, ApplicantProfile, ConsultationBooking
from routers.applicant import refresh_assessment


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
                applicant=refresh_assessment(ApplicantProfile(**applicant_document)),
                latest_consultation=ConsultationBooking(**booking_document),
                consultation_count=booking_counts[applicant_id],
            )
        )
    return results


@router.get("/documents/{document_id}")
async def preview_document(
    document_id: str,
    _: None = Depends(require_admin),
) -> FileResponse:
    applicant = await db.applicant_profiles.find_one(
        {"documents.id": document_id},
        {"documents": 1},
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Document not found")
    document = next(
        (item for item in applicant.get("documents", []) if item.get("id") == document_id),
        None,
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return await document_preview(ApplicantDocument(**document))


@router.patch("/documents/{document_id}/decision", response_model=ApplicantDocument)
async def decide_document(
    document_id: str,
    input: AdminDocumentDecision,
    _: None = Depends(require_admin),
) -> ApplicantDocument:
    applicant = await db.applicant_profiles.find_one({"documents.id": document_id}, {"documents": 1})
    if not applicant:
        raise HTTPException(status_code=404, detail="Document not found")
    document = next(item for item in applicant["documents"] if item["id"] == document_id)
    if not document.get("file_id"):
        raise HTTPException(status_code=422, detail="A stored file is required before making a decision")
    status = "verified" if input.decision == "accept" else "rejected"
    result = await db.applicant_profiles.update_one(
        {"_id": applicant["_id"], "documents": {"$elemMatch": {"id": document_id, "file_id": input.file_id}}},
        {"$set": {"documents.$.status": status, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count != 1:
        raise HTTPException(status_code=409, detail="This file was replaced. Refresh the profile before reviewing it")
    return ApplicantDocument(**{**document, "status": status})