# Educaro Applicant Journey

## What it does
Educaro is a demo-ready agentic applicant workspace for people in India exploring study, vocational training, or employment in Germany. It progressively structures applicant-provided details, maps supporting evidence, surfaces missing requirements, and recommends the next action.

## Data model
- `ApplicantProfile`: name, email, city, pathway, education, language levels, experience, motivation, documents, required_document_kinds, completion, qualification signal, missing items, recommended next step, and an agent trace.
- `ApplicantDocument`: type, title, status (`review`, `verified`, or `rejected`), source label, optional GridFS file id, MIME type, and byte size.
- `ConsultationBooking`: applicant id, preferred date/time, confirmation status, and creation timestamp.
- `AdminBookedProfile`: joins a booked applicant profile, its latest consultation, booking count, and document metadata.
- The first visit starts from `demo-applicant`. An httpOnly `educaro_applicant_id` cookie selects the active profile thereafter.

## Key flows
1. Dashboard loads a persisted demo profile and renders the applicant journey shell even if the API is unavailable.
2. Continue intake opens a guided profile form. Experience is shown and submitted only for the employment pathway. Submitting runs deterministic assessment logic and refreshes the profile through `POST /api/applicant/intake`.
   If the submitted email differs from the active profile (case-insensitive), the backend creates a new UUID profile with no inherited documents or consultations, switches the applicant cookie to it, and leaves the old profile/history unchanged.
3. Add document uploads a validated PDF/JPG/PNG (maximum 10 MB) through `POST /api/applicant/documents/upload`, stores it in MongoDB GridFS, and adds the applicant-provided record to the review queue.
   Applicants can remove documents of any status through `DELETE /api/applicant/documents/{document_id}`; stored GridFS bytes and profile metadata are deleted together.
   Applicants can view only their own files awaiting review via `GET /api/applicant/documents/{document_id}/view`. A valid applicant cookie and ownership are required; verified/rejected files return 403, other profiles' files return 404, and missing sessions return 401. Preview never changes status.
4. Qualification view shows completion, open requirements, agent trace, and the recommended next step.
5. Ask your agent sends a profile-aware query to `POST /api/agent/query/stream` and renders a streamed answer in the dashboard.
6. A ready applicant can choose a preferred date/time in a compact dialog; `POST /api/applicant/consultations` persists the booking and shows an in-dialog confirmation.
7. `/admin` uses an httpOnly PIN session. Authenticated admins can view booked profiles, consultation dates, applicant details, document metadata, and open stored files through `GET /api/admin/documents/{document_id}`. Preview is now read-only (supersedes auto-verification). Explicit Accept / Reject controls call `PATCH /api/admin/documents/{document_id}/decision` with `decision` and the current `file_id`; Accept marks verified, Reject marks rejected. A stale file version returns 409.
8. Rejected applicant documents show “Document not accepted. Please resubmit.” The Resubmit button opens a replacement upload with the same document type; `POST /api/applicant/documents/{document_id}/resubmit` replaces the rejected binary, preserves the document id, resets status to review, and deletes the old GridFS file. Only the owning applicant can resubmit, and only rejected documents support replacement. Off-pathway legacy CV/experience records remain removable; switching back to employment enables resubmission.
9. Applicant status refreshes on window focus and every 10 seconds while the workspace is active. Admin mutations invalidate affected query caches. Rejected files have no applicant View link; resubmitted files become viewable again while in review.

## Document requirements
- Study and vocational training require real uploads of a degree certificate and language certificate.
- Employment requires both certificates plus a current CV and experience letter, regardless of declared years of experience.
- Upload choices come from the backend's `required_document_kinds`; the API rejects CV/experience submissions for non-employment pathways. Existing files are retained when a pathway changes.
- The applicant and admin pages show a required-document checklist. A GridFS-backed upload in review or verified status satisfies submission; rejected files and metadata-only demo records do not. Rejection reopens the requirement and prevents new consultation bookings until replacement. Existing bookings are preserved.
- Missing required uploads block readiness and new consultation bookings (HTTP 422). Existing bookings remain intact. Assessment is refreshed on read so existing records immediately use current rules without modifying their timestamps or history.

## Presentation
- Both applicant and admin pages, including PIN login, intake, upload and booking dialogs, use a dark charcoal theme with light text, subdued green actions, and warm status accents.
- Existing Manrope / IBM Plex Sans typography, responsive layout, and reduced-motion support are retained. Shared semantic theme tokens also map the existing earthy utility palette to charcoal so no legacy light surfaces remain.

## Agent behavior
Qualification assessment still uses deterministic, transparent rules. The query agent uses `openai/gpt-5.4` through the backend-only AICredits OpenAI-compatible gateway and streams responses over SSE. It does not invent applicant information; its system prompt distinguishes applicant facts from recommendations. Real document upload and protected preview are connected; OCR extraction and video transcription remain demo-ready surfaces.

## Auth
The applicant journey is public. The admin panel is protected by an 8-hour signed httpOnly cookie created after PIN login. Logout clears both the server cookie and frontend query cache.

## Storage
MongoDB runs inside the Emergent app pod at `mongodb://localhost:27017`, database `app`. Primary collections are `applicant_profiles`, `consultations`, `document_files.files`, and `document_files.chunks`. New document binaries use GridFS; legacy demo records without a file id remain visibly marked unavailable.