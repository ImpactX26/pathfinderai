# Educaro Applicant Journey

## What it does
Educaro is a demo-ready agentic applicant workspace for people in India exploring study, vocational training, or employment in Germany. It progressively structures applicant-provided details, maps supporting evidence, surfaces missing requirements, and recommends the next action.

## Data model
- `ApplicantProfile`: name, email, city, pathway, education, language levels, experience, motivation, documents, completion, qualification signal, missing items, recommended next step, and an agent trace.
- `ApplicantDocument`: type, title, review status, and source label.
- The demo uses one persisted profile with id `demo-applicant` in MongoDB.

## Key flows
1. Dashboard loads a persisted demo profile and renders the applicant journey shell even if the API is unavailable.
2. Continue intake opens a guided profile form. Submitting runs deterministic assessment logic and refreshes the profile through `POST /api/applicant/intake`.
3. Add document adds applicant-provided evidence to the review queue through `POST /api/applicant/documents`.
4. Qualification view shows completion, open requirements, agent trace, and the recommended next step.

## Agent behavior
The current prototype uses deterministic, transparent assessment rules rather than a live model. It does not invent applicant information; all profile facts are entered by the applicant or are labeled as agent-generated trace text. AI/document upload and video transcription are intentionally represented as demo-ready surfaces, not connected integrations.

## Auth
No authentication or roles are implemented for this public prototype.