export type Pathway = "study" | "vocational" | "employment";
export type DocumentKind = "degree" | "language" | "cv" | "experience";

export interface ApplicantDocument {
  id: string;
  kind: DocumentKind;
  title: string;
  status: "verified" | "review";
  source: "applicant-provided" | "agent-generated";
}

export interface AgentStep {
  label: string;
  detail: string;
  status: "complete" | "active" | "pending";
}

export interface ApplicantProfile {
  id: string;
  name: string;
  email: string;
  city: string;
  pathway: Pathway;
  education: string;
  german_level: string;
  english_level: string;
  experience_years: number;
  motivation: string;
  documents: ApplicantDocument[];
  profile_completion: number;
  qualification_status: "ready" | "needs-review" | "incomplete";
  qualification_label: string;
  missing_items: string[];
  recommended_next_step: string;
  agent_steps: AgentStep[];
  updated_at: string;
}

export interface ApplicantIntake {
  name: string;
  email: string;
  city: string;
  pathway: Pathway;
  education: string;
  german_level: string;
  english_level: string;
  experience_years: number;
  motivation: string;
}

export interface DocumentCreate {
  kind: DocumentKind;
  title: string;
}

export interface AgentQuery {
  query: string;
}

export interface AgentStreamEvent {
  type: "delta" | "done" | "error";
  content: string;
}

export interface ConsultationCreate {
  preferred_date: string;
  preferred_time: string;
}

export interface ConsultationBooking {
  id: string;
  applicant_id: string;
  preferred_date: string;
  preferred_time: string;
  status: "confirmed";
  created_at: string;
}

export interface AdminSession {
  authenticated: boolean;
}

export interface AdminBookedProfile {
  applicant: ApplicantProfile;
  latest_consultation: ConsultationBooking;
  consultation_count: number;
}