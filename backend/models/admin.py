from pydantic import BaseModel, Field

from models.applicant import ApplicantProfile, ConsultationBooking


class AdminLogin(BaseModel):
    pin: str = Field(min_length=4, max_length=32)


class AdminSession(BaseModel):
    authenticated: bool


class AdminBookedProfile(BaseModel):
    applicant: ApplicantProfile
    latest_consultation: ConsultationBooking
    consultation_count: int