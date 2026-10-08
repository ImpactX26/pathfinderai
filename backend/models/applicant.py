from datetime import date, datetime, timezone
from typing import Literal
import uuid

from pydantic import BaseModel, Field


Pathway = Literal["study", "vocational", "employment"]
QualificationStatus = Literal["ready", "needs-review", "incomplete"]
DocumentKind = Literal["degree", "language", "cv", "experience"]


class ApplicantDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: DocumentKind
    title: str
    status: Literal["verified", "review"] = "review"
    source: Literal["applicant-provided", "agent-generated"] = "applicant-provided"
    file_id: str | None = None
    content_type: str | None = None
    file_size: int | None = None


class AgentStep(BaseModel):
    label: str
    detail: str
    status: Literal["complete", "active", "pending"]


class ApplicantProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    city: str
    pathway: Pathway
    education: str
    german_level: str
    english_level: str
    experience_years: int = 0
    motivation: str
    documents: list[ApplicantDocument] = Field(default_factory=list)
    profile_completion: int = 0
    qualification_status: QualificationStatus = "incomplete"
    qualification_label: str
    missing_items: list[str] = Field(default_factory=list)
    recommended_next_step: str
    agent_steps: list[AgentStep] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ApplicantIntake(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(min_length=5)
    city: str = Field(min_length=2)
    pathway: Pathway
    education: str = Field(min_length=2)
    german_level: str
    english_level: str
    experience_years: int = Field(default=0, ge=0, le=50)
    motivation: str = Field(min_length=10)


class DocumentCreate(BaseModel):
    kind: DocumentKind
    title: str = Field(min_length=2)


class ConsultationCreate(BaseModel):
    preferred_date: date
    preferred_time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class ConsultationBooking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    applicant_id: str
    preferred_date: date
    preferred_time: str
    status: Literal["confirmed"] = "confirmed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))