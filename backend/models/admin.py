from typing import Literal

from pydantic import BaseModel, Field

from models.applicant import ApplicantProfile, ConsultationBooking


class AdminLogin(BaseModel):
    pin: str = Field(min_length=4, max_length=32)


class AdminSession(BaseModel):
    authenticated: bool


class AdminDocumentDecision(BaseModel):
    decision: Literal["accept", "reject"]
    file_id: str = Field(min_length=1)


class AdminBookedProfile(BaseModel):
    applicant: ApplicantProfile
    latest_consultation: ConsultationBooking
    consultation_count: int