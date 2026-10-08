# Educaro Applicant Journey

## What it does
Educaro is a demo-ready agentic applicant workspace for people in India exploring study, vocational training, or employment in Germany. It progressively structures applicant-provided details, maps supporting evidence, surfaces missing requirements, and recommends the next action.

## Data model
- `ApplicantProfile`: name, email, city, pathway, education, language levels, experience, motivation, documents, completion, qualification signal, missing items, recommended next step, and an agent trace.
- `ApplicantDocument`: type, title, review status, and source label.
- `ConsultationBooking`: applicant id, preferred date/time, confirmation status, and creation timestamp.
- `AdminBookedProfile`: joins a booked applicant profile, its latest consultation, booking count, and document metadata.
- The demo uses one persisted profile with id `demo-applicant` in MongoDB.

## Key flows
1. Dashboard loads a persisted demo profile and renders the applicant journey shell even if the API is unavailable.
2. Continue intake opens a guided profile form. Experience is shown and submitted only for the employment pathway. Submitting runs deterministic assessment logic and refreshes the profile through `POST /api/applicant/intake`.
3. Add document adds applicant-provided evidence to the review queue through `POST /api/applicant/documents`.
4. Qualification view shows completion, open requirements, agent trace, and the recommended next step.
5. Ask your agent sends a profile-aware query to `POST /api/agent/query/stream` and renders a streamed answer in the dashboard.
6. A ready applicant can choose a preferred date/time in a compact dialog; `POST /api/applicant/consultations` persists the booking and shows an in-dialog confirmation.
7. `/admin` uses an httpOnly PIN session. Authenticated admins can view booked profiles, consultation dates, applicant details, and document metadata from `GET /api/admin/booked-profiles`.

## Agent behavior
Qualification assessment still uses deterministic, transparent rules. The query agent uses `openai/gpt-5.4` through the backend-only AICredits OpenAI-compatible gateway and streams responses over SSE. It does not invent applicant information; its system prompt distinguishes applicant facts from recommendations. Document upload/OCR and video transcription remain demo-ready surfaces, not connected integrations.

## Auth
The applicant journey is public. The admin panel is protected by an 8-hour signed httpOnly cookie created after PIN login. Logout clears both the server cookie and frontend query cache.

## Storage
MongoDB runs inside the Emergent app pod at `mongodb://localhost:27017`, database `app`. Primary collections are `applicant_profiles` and `consultations`. Document entries currently store metadata only; binary file/object storage is not connected.