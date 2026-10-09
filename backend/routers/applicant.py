from datetime import datetime, timezone
import os
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile
from gridfs.errors import NoFile

from lib.db import db, get_document_files
from lib.dates import today_iso
from lib.documents import document_preview, read_document_upload
from models.applicant import (
    AgentStep,
    ApplicantDocument,
    ApplicantIntake,
    ApplicantProfile,
    ConsultationBooking,
    ConsultationCreate,
    DocumentCreate,
    DocumentKind,
)


router = APIRouter(prefix="/applicant", tags=["applicant"])
DEMO_ID = "demo-applicant"
APPLICANT_COOKIE_NAME = "educaro_applicant_id"

DOCUMENT_LABELS: dict[str, str] = {
    "degree": "Degree certificate",
    "language": "Language certificate",
    "cv": "Current CV",
    "experience": "Experience letter",
}


def required_document_kinds(pathway: str) -> list[DocumentKind]:
    required: list[DocumentKind] = ["degree", "language"]
    if pathway == "employment":
        required.extend(["cv", "experience"])
    return required


def validate_document_kind(kind: str, pathway: str) -> None:
    if kind not in required_document_kinds(pathway):
        raise HTTPException(status_code=422, detail="Current CV and experience letter are for the employment pathway only")


def build_assessment(
    *,
    applicant_id: str = DEMO_ID,
    pathway: str,
    education: str,
    german_level: str,
    english_level: str,
    experience_years: int,
    documents: list[ApplicantDocument],
    name: str,
    email: str,
    city: str,
    motivation: str,
) -> ApplicantProfile:
    # A metadata-only demo record is not an actual submitted certificate.
    document_kinds = {document.kind for document in documents if document.file_id and document.status != "rejected"}
    required = required_document_kinds(pathway)
    missing: list[str] = []
    if not name or not email or not city:
        missing.append("Basic contact details")
    if not education:
        missing.append("Education history")
    if not motivation:
        missing.append("Motivation for Germany")
    if pathway in {"study", "vocational"} and german_level in {"none", "A1"}:
        missing.append("German language level B1 or above")
    if pathway == "employment" and experience_years < 1:
        missing.append("At least 1 year of relevant experience")
    missing.extend(DOCUMENT_LABELS[kind] for kind in required if kind not in document_kinds)

    total_checks = 4 + len(required)
    completed_checks = total_checks - min(len(missing), total_checks)
    completion = round((completed_checks / total_checks) * 100)
    if len(missing) == 0:
        status = "ready"
        label = "Ready for consultant review"
        next_step = "Book a pathway consultation with an Educaro specialist"
    elif len(missing) <= 3:
        status = "needs-review"
        label = "Almost ready — a few details needed"
        next_step = f"Add {missing[0].lower()} to unlock your recommendation"
    else:
        status = "incomplete"
        label = "More information needed"
        next_step = "Complete your applicant profile to start qualification"

    steps = [
        AgentStep(label="Profile assembled", detail="Applicant-provided details structured", status="complete"),
        AgentStep(label="Evidence mapped", detail=f"{len(documents)} supporting document(s) linked", status="complete" if documents else "active"),
        AgentStep(label="Requirements checked", detail=f"{len(missing)} open requirement(s) found", status="complete" if len(missing) <= 3 else "active"),
        AgentStep(label="Next step selected", detail=next_step, status="complete" if completion >= 75 else "pending"),
    ]

    return ApplicantProfile(
        id=applicant_id,
        name=name,
        email=email,
        city=city,
        pathway=pathway,  # type: ignore[arg-type]
        education=education,
        german_level=german_level,
        english_level=english_level,
        experience_years=experience_years,
        motivation=motivation,
        documents=documents,
        required_document_kinds=required,
        profile_completion=completion,
        qualification_status=status,  # type: ignore[arg-type]
        qualification_label=label,
        missing_items=missing,
        recommended_next_step=next_step,
        agent_steps=steps,
        updated_at=datetime.now(timezone.utc),
    )


def demo_profile() -> ApplicantProfile:
    documents = [
        ApplicantDocument(kind="degree", title="B.Tech Computer Science.pdf", status="verified"),
        ApplicantDocument(kind="language", title="IELTS Academic certificate.pdf", status="verified"),
    ]
    return build_assessment(
        pathway="study",
        education="B.Tech Computer Science",
        german_level="A2",
        english_level="C1",
        experience_years=1,
        documents=documents,
        name="Aarav Mehta",
        email="aarav.mehta@email.com",
        city="Bengaluru, India",
        motivation="I want to build a career in sustainable technology in Germany.",
    )


async def save_profile(profile: ApplicantProfile) -> ApplicantProfile:
    await db.applicant_profiles.replace_one(
        {"id": profile.id}, profile.model_dump(), upsert=True
    )
    return profile


def set_applicant_cookie(response: Response, applicant_id: str) -> None:
    response.set_cookie(
        key=APPLICANT_COOKIE_NAME,
        value=applicant_id,
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        secure=os.environ.get("APP_URL", "").startswith("https://"),
        samesite="lax",
        path="/",
    )


async def get_applicant_by_id(applicant_id: str) -> ApplicantProfile | None:
    document = await db.applicant_profiles.find_one({"id": applicant_id})
    return refresh_assessment(ApplicantProfile(**document)) if document else None


def refresh_assessment(profile: ApplicantProfile) -> ApplicantProfile:
    """Apply current rules to saved profiles without changing their history."""
    assessed = build_assessment(
        applicant_id=profile.id,
        **profile.model_dump(include={
            "pathway", "education", "german_level", "english_level",
            "experience_years", "name", "email", "city", "motivation",
        }),
        documents=profile.documents,
    )
    return assessed.model_copy(update={"updated_at": profile.updated_at})


async def get_current_applicant(request: Request) -> ApplicantProfile:
    applicant_id = request.cookies.get(APPLICANT_COOKIE_NAME, DEMO_ID)
    profile = await get_applicant_by_id(applicant_id)
    if profile:
        return profile
    demo = await get_applicant_by_id(DEMO_ID)
    return demo if demo else await save_profile(demo_profile())


async def get_owned_document(request: Request, document_id: str) -> tuple[ApplicantProfile, ApplicantDocument]:
    applicant_id = request.cookies.get(APPLICANT_COOKIE_NAME)
    if not applicant_id:
        raise HTTPException(status_code=401, detail="Applicant session required")
    profile = await get_applicant_by_id(applicant_id)
    if not profile:
        raise HTTPException(status_code=401, detail="Applicant session not found")
    document = next((item for item in profile.documents if item.id == document_id), None)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return profile, document


@router.get("", response_model=ApplicantProfile)
async def get_applicant(request: Request, response: Response) -> ApplicantProfile:
    profile = await get_current_applicant(request)
    set_applicant_cookie(response, profile.id)
    return profile


@router.post("/intake", response_model=ApplicantProfile)
async def submit_intake(input: ApplicantIntake, request: Request, response: Response) -> ApplicantProfile:
    current = await get_current_applicant(request)
    changed_email = input.email.strip().casefold() != current.email.strip().casefold()
    applicant_id = str(uuid4()) if changed_email else current.id
    profile = build_assessment(
        applicant_id=applicant_id,
        pathway=input.pathway,
        education=input.education,
        german_level=input.german_level,
        english_level=input.english_level,
        experience_years=input.experience_years,
        documents=[] if changed_email else current.documents,
        name=input.name,
        email=input.email.strip(),
        city=input.city,
        motivation=input.motivation,
    )
    saved = await save_profile(profile)
    set_applicant_cookie(response, saved.id)
    return saved


@router.post("/documents", response_model=ApplicantProfile)
async def add_document(input: DocumentCreate, request: Request, response: Response) -> ApplicantProfile:
    current = await get_current_applicant(request)
    validate_document_kind(input.kind, current.pathway)
    documents = [*current.documents, ApplicantDocument(kind=input.kind, title=input.title, status="review")]
    profile = build_assessment(
        applicant_id=current.id,
        pathway=current.pathway,
        education=current.education,
        german_level=current.german_level,
        english_level=current.english_level,
        experience_years=current.experience_years,
        documents=documents,
        name=current.name,
        email=current.email,
        city=current.city,
        motivation=current.motivation,
    )
    saved = await save_profile(profile)
    set_applicant_cookie(response, saved.id)
    return saved


@router.post("/documents/upload", response_model=ApplicantProfile)
async def upload_document(
    request: Request,
    response: Response,
    kind: str = Form(...),
    file: UploadFile = File(...),
) -> ApplicantProfile:
    document_files = get_document_files()
    current = await get_current_applicant(request)
    if kind not in {"degree", "language", "cv", "experience"}:
        raise HTTPException(status_code=422, detail="Unsupported document type")
    validate_document_kind(kind, current.pathway)
    filename, content_type, content = await read_document_upload(file)

    file_id = await document_files.upload_from_stream(
        filename,
        content,
        metadata={"content_type": content_type, "applicant_id": current.id},
    )
    applicant_document = ApplicantDocument(
        kind=kind,  # type: ignore[arg-type]
        title=filename,
        status="review",
        file_id=str(file_id),
        content_type=content_type,
        file_size=len(content),
    )
    documents = [*current.documents, applicant_document]
    profile = build_assessment(
        applicant_id=current.id,
        pathway=current.pathway,
        education=current.education,
        german_level=current.german_level,
        english_level=current.english_level,
        experience_years=current.experience_years,
        documents=documents,
        name=current.name,
        email=current.email,
        city=current.city,
        motivation=current.motivation,
    )
    try:
        saved = await save_profile(profile)
        set_applicant_cookie(response, saved.id)
        return saved
    except Exception:
        await document_files.delete(file_id)
        raise


@router.get("/documents/{document_id}/view")
async def view_review_document(document_id: str, request: Request) -> Response:
    _, document = await get_owned_document(request, document_id)
    if document.status != "review":
        raise HTTPException(status_code=403, detail="Applicants can view only documents awaiting review")
    return await document_preview(document)


@router.post("/documents/{document_id}/resubmit", response_model=ApplicantProfile)
async def resubmit_document(document_id: str, request: Request, response: Response, file: UploadFile = File(...)) -> ApplicantProfile:
    current, previous = await get_owned_document(request, document_id)
    if previous.status != "rejected":
        raise HTTPException(status_code=409, detail="Only rejected documents can be resubmitted")
    validate_document_kind(previous.kind, current.pathway)
    filename, content_type, content = await read_document_upload(file)
    document_files = get_document_files()
    file_id = await document_files.upload_from_stream(
        filename, content, metadata={"content_type": content_type, "applicant_id": current.id},
    )
    replacement = ApplicantDocument(
        id=previous.id, kind=previous.kind, title=filename, status="review",
        file_id=str(file_id), content_type=content_type, file_size=len(content),
    )
    try:
        # Match the rejected version to avoid replacing a newer upload or decision.
        result = await db.applicant_profiles.update_one(
            {"id": current.id, "documents": {"$elemMatch": {"id": document_id, "status": "rejected", "file_id": previous.file_id}}},
            {"$set": {"documents.$": replacement.model_dump(), "updated_at": datetime.now(timezone.utc)}},
        )
        if result.matched_count != 1:
            raise HTTPException(status_code=409, detail="Document changed. Refresh your profile and try again")
    except Exception:
        await document_files.delete(file_id)
        raise
    if previous.file_id:
        try:
            await document_files.delete(ObjectId(previous.file_id))
        except (NoFile, ValueError):
            pass
    refreshed = await get_applicant_by_id(current.id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    set_applicant_cookie(response, refreshed.id)
    return refreshed


@router.delete("/documents/{document_id}", response_model=ApplicantProfile)
async def remove_document(document_id: str, request: Request, response: Response) -> ApplicantProfile:
    current = await get_current_applicant(request)
    document = next((item for item in current.documents if item.id == document_id), None)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.file_id:
        try:
            await get_document_files().delete(ObjectId(document.file_id))
        except (NoFile, ValueError):
            pass

    documents = [item for item in current.documents if item.id != document_id]
    profile = build_assessment(
        applicant_id=current.id,
        pathway=current.pathway,
        education=current.education,
        german_level=current.german_level,
        english_level=current.english_level,
        experience_years=current.experience_years,
        documents=documents,
        name=current.name,
        email=current.email,
        city=current.city,
        motivation=current.motivation,
    )
    saved = await save_profile(profile)
    set_applicant_cookie(response, saved.id)
    return saved


@router.post("/consultations", response_model=ConsultationBooking)
async def book_consultation(input: ConsultationCreate, request: Request, response: Response) -> ConsultationBooking:
    if input.preferred_date.isoformat() < today_iso():
        raise HTTPException(status_code=422, detail="Choose today or a future date")
    current = await get_current_applicant(request)
    uploaded_kinds = {document.kind for document in current.documents if document.file_id and document.status != "rejected"}
    missing_documents = [DOCUMENT_LABELS[kind] for kind in required_document_kinds(current.pathway) if kind not in uploaded_kinds]
    if missing_documents:
        raise HTTPException(status_code=422, detail=f"Upload required documents before booking: {', '.join(missing_documents)}")
    booking = ConsultationBooking(
        applicant_id=current.id,
        preferred_date=input.preferred_date,
        preferred_time=input.preferred_time,
    )
    await db.consultations.insert_one(booking.model_dump(mode="json"))
    set_applicant_cookie(response, current.id)
    return booking