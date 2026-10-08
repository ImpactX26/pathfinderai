from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from lib.db import db, get_document_files
from lib.dates import today_iso
from models.applicant import (
    AgentStep,
    ApplicantDocument,
    ApplicantIntake,
    ApplicantProfile,
    ConsultationBooking,
    ConsultationCreate,
    DocumentCreate,
)


router = APIRouter(prefix="/applicant", tags=["applicant"])
DEMO_ID = "demo-applicant"
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf": (".pdf", b"%PDF-"),
    "image/jpeg": ((".jpg", ".jpeg"), b"\xff\xd8\xff"),
    "image/png": (".png", b"\x89PNG\r\n\x1a\n"),
}


def build_assessment(
    *,
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
    document_kinds = {document.kind for document in documents}
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
    if "degree" not in document_kinds and pathway != "employment":
        missing.append("Degree or qualification certificate")
    if "cv" not in document_kinds:
        missing.append("Current CV")

    total_checks = 8
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
        id=DEMO_ID,
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


@router.get("", response_model=ApplicantProfile)
async def get_applicant() -> ApplicantProfile:
    document = await db.applicant_profiles.find_one({"id": DEMO_ID})
    if document:
        return ApplicantProfile(**document)
    return await save_profile(demo_profile())


@router.post("/intake", response_model=ApplicantProfile)
async def submit_intake(input: ApplicantIntake) -> ApplicantProfile:
    current = await get_applicant()
    profile = build_assessment(
        pathway=input.pathway,
        education=input.education,
        german_level=input.german_level,
        english_level=input.english_level,
        experience_years=input.experience_years,
        documents=current.documents,
        name=input.name,
        email=input.email,
        city=input.city,
        motivation=input.motivation,
    )
    return await save_profile(profile)


@router.post("/documents", response_model=ApplicantProfile)
async def add_document(input: DocumentCreate) -> ApplicantProfile:
    current = await get_applicant()
    documents = [*current.documents, ApplicantDocument(kind=input.kind, title=input.title, status="review")]
    profile = build_assessment(
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
    return await save_profile(profile)


@router.post("/documents/upload", response_model=ApplicantProfile)
async def upload_document(
    kind: str = Form(...),
    file: UploadFile = File(...),
) -> ApplicantProfile:
    document_files = get_document_files()
    if kind not in {"degree", "language", "cv", "experience"}:
        raise HTTPException(status_code=422, detail="Unsupported document type")
    content_type = file.content_type or ""
    allowed = ALLOWED_DOCUMENT_TYPES.get(content_type)
    filename = Path(file.filename or "").name
    if not allowed or not filename:
        raise HTTPException(status_code=415, detail="Upload a PDF, JPG or PNG file")
    extensions, signature = allowed
    valid_extensions = (extensions,) if isinstance(extensions, str) else extensions
    if Path(filename).suffix.lower() not in valid_extensions:
        raise HTTPException(status_code=415, detail="File extension does not match its content type")

    content = await file.read(MAX_DOCUMENT_BYTES + 1)
    await file.close()
    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Document must be 10 MB or smaller")
    if not content.startswith(signature):
        raise HTTPException(status_code=415, detail="File content does not match the selected format")

    file_id = await document_files.upload_from_stream(
        filename,
        content,
        metadata={"content_type": content_type, "applicant_id": DEMO_ID},
    )
    applicant_document = ApplicantDocument(
        kind=kind,  # type: ignore[arg-type]
        title=filename,
        status="review",
        file_id=str(file_id),
        content_type=content_type,
        file_size=len(content),
    )
    current = await get_applicant()
    documents = [*current.documents, applicant_document]
    profile = build_assessment(
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
        return await save_profile(profile)
    except Exception:
        await document_files.delete(file_id)
        raise


@router.post("/consultations", response_model=ConsultationBooking)
async def book_consultation(input: ConsultationCreate) -> ConsultationBooking:
    if input.preferred_date.isoformat() < today_iso():
        raise HTTPException(status_code=422, detail="Choose today or a future date")
    booking = ConsultationBooking(
        applicant_id=DEMO_ID,
        preferred_date=input.preferred_date,
        preferred_time=input.preferred_time,
    )
    await db.consultations.insert_one(booking.model_dump(mode="json"))
    return booking