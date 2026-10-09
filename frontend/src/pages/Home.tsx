import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  Eye,
  FileText,
  GraduationCap,
  Languages,
  Leaf,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RequiredDocuments, documentLabels } from "@/components/required-documents";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiDelete, apiGet, apiPost, apiStream, apiUpload } from "@/lib/api";
import type {
  AgentQuery,
  AgentStreamEvent,
  ApplicantDocument,
  ApplicantIntake,
  ApplicantProfile,
  ConsultationBooking,
  ConsultationCreate,
  DocumentUploadInput,
  DocumentKind,
  Pathway,
} from "@/lib/types";

const studentAvatar =
  "https://images.unsplash.com/photo-1560543685-824b3c5e82ad?crop=entropy&cs=srgb&fm=jpg&q=80&w=160&h=160&fit=crop";

const demoProfile: ApplicantProfile = {
  id: "demo-applicant",
  name: "Aarav Mehta",
  email: "aarav.mehta@email.com",
  city: "Bengaluru, India",
  pathway: "study",
  education: "B.Tech Computer Science",
  german_level: "A2",
  english_level: "C1",
  experience_years: 1,
  motivation: "I want to build a career in sustainable technology in Germany.",
  documents: [
    { id: "degree", kind: "degree", title: "B.Tech Computer Science.pdf", status: "verified", source: "applicant-provided", file_id: null, content_type: null, file_size: null },
    { id: "language", kind: "language", title: "IELTS Academic certificate.pdf", status: "verified", source: "applicant-provided", file_id: null, content_type: null, file_size: null },
  ],
  required_document_kinds: ["degree", "language"],
  profile_completion: 67,
  qualification_status: "needs-review",
  qualification_label: "Almost ready — a few details needed",
  missing_items: ["Degree certificate", "Language certificate"],
  recommended_next_step: "Upload your degree certificate to unlock your recommendation",
  agent_steps: [
    { label: "Profile assembled", detail: "Applicant-provided details structured", status: "complete" },
    { label: "Evidence mapped", detail: "2 supporting documents linked", status: "complete" },
    { label: "Requirements checked", detail: "2 required uploads needed", status: "active" },
    { label: "Next step selected", detail: "Waiting for missing evidence", status: "pending" },
  ],
  updated_at: new Date().toISOString(),
};

const pathwayLabels: Record<Pathway, string> = {
  study: "Study in Germany",
  vocational: "Vocational training",
  employment: "Find employment",
};

const pathwayIcons: Record<Pathway, typeof GraduationCap> = {
  study: GraduationCap,
  vocational: BriefcaseBusiness,
  employment: UserRound,
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatPathway(pathway: Pathway) {
  return pathwayLabels[pathway];
}

function StatusMark({ status, testId }: { status: ApplicantDocument["status"]; testId: string }) {
  return status === "rejected" ? (
    <span data-testid={`${testId}-rejected-mark`} className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><AlertCircle className="size-3.5" aria-hidden="true" /> Not accepted</span>
  ) : status === "verified" ? (
    <span data-testid={`${testId}-verified-mark`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#4a6b53]">
      <ShieldCheck className="size-3.5" aria-hidden="true" /> Verified
    </span>
  ) : (
    <span data-testid={`${testId}-review-mark`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#a66350]">
      <Clock3 className="size-3.5" aria-hidden="true" /> Review queue
    </span>
  );
}

function IntakePanel({
  profile,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  profile: ApplicantProfile;
  onClose: () => void;
  onSubmit: (payload: ApplicantIntake) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<ApplicantIntake>({
    name: profile.name,
    email: profile.email,
    city: profile.city,
    pathway: profile.pathway,
    education: profile.education,
    german_level: profile.german_level,
    english_level: profile.english_level,
    experience_years: profile.experience_years,
    motivation: profile.motivation,
  });

  const update = <K extends keyof ApplicantIntake>(key: K, value: ApplicantIntake[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div data-testid="intake-panel-overlay" className="fixed inset-0 z-50 flex items-end justify-end bg-[#2c3b2e]/25 p-0 backdrop-blur-[2px] sm:p-5">
      <div data-testid="intake-panel" className="max-h-[96vh] w-full overflow-y-auto rounded-t-3xl border border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p data-testid="intake-panel-overline" className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#a66350]">Agent intake</p>
            <h2 data-testid="intake-panel-title" className="font-heading text-2xl font-extrabold tracking-tight text-[#2c3b2e]">Let’s sharpen your route</h2>
            <p data-testid="intake-panel-description" className="mt-2 max-w-md text-sm leading-6 text-[#5c6b5e]">Your answers help the agent ask only what matters for your Germany pathway.</p>
          </div>
          <Button data-testid="intake-panel-close-button" variant="ghost" size="icon" onClick={onClose} className="rounded-full text-[#5c6b5e] hover:bg-[#ebe9e4] hover:text-[#2c3b2e]">
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Close intake</span>
          </Button>
        </div>

        <form data-testid="intake-form" className="mt-8 space-y-6" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, experience_years: form.pathway === "employment" ? form.experience_years : 0 }); }}>
          <div>
            <label data-testid="pathway-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">What are you moving towards?</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(pathwayLabels) as Pathway[]).map((pathway) => {
                const Icon = pathwayIcons[pathway];
                const selected = form.pathway === pathway;
                return (
                  <button
                    type="button"
                    key={pathway}
                    data-testid={`pathway-option-${pathway}`}
                    onClick={() => update("pathway", pathway)}
                    className={`rounded-xl border p-3 text-left ${selected ? "border-[#4a6b53] bg-[#e8efe9] text-[#2c3b2e] shadow-sm" : "border-[#d5d1c9] bg-white text-[#5c6b5e] hover:-translate-y-0.5 hover:border-[#4a6b53]"}`}
                  >
                    <Icon className="mb-2 size-4" aria-hidden="true" />
                    <span data-testid={`pathway-option-label-${pathway}`} className="block text-xs font-semibold leading-4">{pathwayLabels[pathway]}</span>
                  </button>
                );
              })}
            </div>
            <p data-testid="intake-document-requirements" className="mt-3 rounded-xl border border-border bg-secondary/40 p-3 text-xs leading-5 text-muted-foreground">Degree and language certificates are compulsory for all pathways.{form.pathway === "employment" ? " You will also need a current CV and experience letter." : " CV and experience letter are only needed for employment."} Upload these in your evidence locker after saving.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="applicant-name" data-testid="name-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Full name</label>
              <Input id="applicant-name" data-testid="intake-name-input" value={form.name} onChange={(event) => update("name", event.target.value)} className="h-11 border-[#d5d1c9] bg-white focus-visible:ring-[#4a6b53]" />
            </div>
            <div>
              <label htmlFor="applicant-email" data-testid="email-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Email</label>
              <Input id="applicant-email" data-testid="intake-email-input" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} className="h-11 border-[#d5d1c9] bg-white focus-visible:ring-[#4a6b53]" />
            </div>
            <div>
              <label htmlFor="applicant-city" data-testid="city-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Current city</label>
              <Input id="applicant-city" data-testid="intake-city-input" value={form.city} onChange={(event) => update("city", event.target.value)} className="h-11 border-[#d5d1c9] bg-white focus-visible:ring-[#4a6b53]" />
            </div>
            <div>
              <label htmlFor="applicant-education" data-testid="education-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Highest qualification</label>
              <Input id="applicant-education" data-testid="intake-education-input" value={form.education} onChange={(event) => update("education", event.target.value)} className="h-11 border-[#d5d1c9] bg-white focus-visible:ring-[#4a6b53]" />
            </div>
          </div>

          <div className={`grid gap-4 ${form.pathway === "employment" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <div>
              <label htmlFor="german-level" data-testid="german-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">German level</label>
              <select id="german-level" data-testid="intake-german-select" value={form.german_level} onChange={(event) => update("german_level", event.target.value)} className="h-11 w-full rounded-md border border-[#d5d1c9] bg-white px-3 text-sm text-[#2c3b2e] outline-none focus:border-[#4a6b53] focus:ring-2 focus:ring-[#4a6b53]/20">
                {['none', 'A1', 'A2', 'B1', 'B2', 'C1'].map((level) => <option key={level} value={level}>{level === 'none' ? 'Not started' : level}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="english-level" data-testid="english-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">English level</label>
              <select id="english-level" data-testid="intake-english-select" value={form.english_level} onChange={(event) => update("english_level", event.target.value)} className="h-11 w-full rounded-md border border-[#d5d1c9] bg-white px-3 text-sm text-[#2c3b2e] outline-none focus:border-[#4a6b53] focus:ring-2 focus:ring-[#4a6b53]/20">
                {['B1', 'B2', 'C1', 'C2'].map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            {form.pathway === "employment" && <div data-testid="experience-field-container">
              <label htmlFor="experience-years" data-testid="experience-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Experience (years)</label>
              <Input id="experience-years" data-testid="intake-experience-input" type="number" min="0" max="50" value={form.experience_years} onChange={(event) => update("experience_years", Number(event.target.value))} className="h-11 border-[#d5d1c9] bg-white focus-visible:ring-[#4a6b53]" />
            </div>}
          </div>

          <div>
            <label htmlFor="applicant-motivation" data-testid="motivation-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">In one sentence, why Germany?</label>
            <textarea id="applicant-motivation" data-testid="intake-motivation-input" value={form.motivation} onChange={(event) => update("motivation", event.target.value)} className="min-h-24 w-full resize-y rounded-md border border-[#d5d1c9] bg-white px-3 py-3 text-sm text-[#2c3b2e] outline-none placeholder:text-[#879087] focus:border-[#4a6b53] focus:ring-2 focus:ring-[#4a6b53]/20" />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#ebe9e4] pt-6 sm:flex-row sm:justify-end">
            <Button data-testid="intake-cancel-button" type="button" variant="ghost" onClick={onClose} className="rounded-full text-[#5c6b5e] hover:bg-[#ebe9e4] hover:text-[#2c3b2e]">Not now</Button>
            <Button data-testid="intake-submit-button" type="submit" disabled={isSubmitting} className="rounded-full bg-[#4a6b53] px-6 text-white hover:-translate-y-0.5 hover:bg-[#3a5541] disabled:opacity-60">
              {isSubmitting ? "Scanning your profile…" : "Run profile scan"}
              {!isSubmitting && <ArrowUpRight className="ml-2 size-4" aria-hidden="true" />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentPanel({ profile, resubmission, onClose, onSubmit, isSubmitting }: { profile: ApplicantProfile; resubmission: ApplicantDocument | null; onClose: () => void; onSubmit: (payload: DocumentUploadInput) => void; isSubmitting: boolean }) {
  const availableKinds = resubmission ? [resubmission.kind] : profile.required_document_kinds;
  const [kind, setKind] = useState<DocumentKind>(() => resubmission?.kind ?? availableKinds.find((option) => !profile.documents.some((document) => document.kind === option && document.file_id && document.status !== "rejected")) ?? "degree");
  const [file, setFile] = useState<File | null>(null);
  return (
    <div data-testid="document-panel-overlay" className="fixed inset-0 z-50 flex items-end justify-end bg-[#2c3b2e]/25 p-0 backdrop-blur-[2px] sm:p-5">
      <div data-testid="document-panel" className="max-h-[96svh] w-full overflow-y-auto rounded-t-3xl border border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p data-testid="document-panel-overline" className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#a66350]">Evidence locker</p>
            <h2 data-testid="document-panel-title" className="font-heading text-2xl font-extrabold tracking-tight text-[#2c3b2e]">{resubmission ? "Resubmit your document" : "Add a document"}</h2>
            <p data-testid="document-panel-description" className="mt-2 text-sm leading-6 text-[#5c6b5e]">{profile.pathway === "employment" ? "Degree certificate, language certificate, current CV and experience letter are compulsory for employment." : "Degree and language certificates are compulsory for your pathway."} Upload a PDF or image for review.</p>
          </div>
          <Button data-testid="document-panel-close-button" variant="ghost" size="icon" onClick={onClose} className="rounded-full text-[#5c6b5e] hover:bg-[#ebe9e4] hover:text-[#2c3b2e]"><X className="size-5" aria-hidden="true" /><span className="sr-only">Close document panel</span></Button>
        </div>
        {resubmission && <p data-testid="document-resubmit-notice" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs leading-5 text-destructive">Document not accepted. Please resubmit. Your new file will replace {resubmission.title} and return to the review queue.</p>}
        <form data-testid="document-form" className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); if (file) onSubmit({ kind, file, document_id: resubmission?.id }); }}>
          <label htmlFor="document-file" data-testid="upload-dropzone" className="block cursor-pointer rounded-2xl border border-dashed border-[#b9c5ba] bg-[#f1f5f1] p-6 text-center hover:border-[#4a6b53] hover:bg-[#edf4ee]">
            <UploadCloud className="mx-auto mb-3 size-8 text-[#4a6b53]" aria-hidden="true" />
            <p data-testid="upload-dropzone-title" className="text-sm font-semibold text-[#2c3b2e]">{file ? file.name : "Choose a PDF, JPG or PNG"}</p>
            <p data-testid="upload-dropzone-description" className="mt-1 text-xs text-[#5c6b5e]">{file ? `${(file.size / 1024).toFixed(1)} KB selected` : "Maximum file size: 10 MB"}</p>
            <input id="document-file" data-testid="document-file-input" type="file" accept="application/pdf,image/jpeg,image/png" required className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <div>
            <label htmlFor="document-kind" data-testid="document-kind-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Document type</label>
            <select id="document-kind" data-testid="document-kind-select" disabled={Boolean(resubmission)} value={kind} onChange={(event) => setKind(event.target.value as DocumentKind)} className="h-11 w-full rounded-md border border-[#d5d1c9] bg-white px-3 text-sm text-[#2c3b2e] outline-none focus:border-[#4a6b53] focus:ring-2 focus:ring-[#4a6b53]/20">
              {availableKinds.map((option) => <option data-testid={`document-kind-option-${option}`} key={option} value={option} label={`${documentLabels[option]} · Required`} />)}
            </select>
          </div>
          <Button data-testid="document-submit-button" type="submit" disabled={isSubmitting || !file} className="w-full rounded-full bg-[#4a6b53] text-white hover:-translate-y-0.5 hover:bg-[#3a5541] disabled:opacity-60">{isSubmitting ? "Uploading securely…" : resubmission ? "Resubmit for review" : "Upload for review"}</Button>
        </form>
      </div>
    </div>
  );
}

function DocumentRow({ document, onRemove, onResubmit, canResubmit }: { document: ApplicantDocument; onRemove: (document: ApplicantDocument) => void; onResubmit: (document: ApplicantDocument) => void; canResubmit: boolean }) {
  return (
    <div data-testid={`document-row-${document.id}`} className={`rounded-xl border bg-background/60 p-3 ${document.status === "rejected" ? "border-destructive/40" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <div data-testid={`document-icon-${document.id}`} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><FileText className="size-4" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <p data-testid={`document-title-${document.id}`} className="break-words text-sm font-semibold text-foreground">{document.title}</p>
          <p data-testid={`document-type-${document.id}`} className="mt-0.5 text-xs text-muted-foreground">{documentLabels[document.kind]} · {document.source === "applicant-provided" ? "Applicant provided" : "Agent generated"}</p>
        </div>
        <Button data-testid={`document-remove-button-${document.id}`} aria-label={`Remove ${document.title}`} type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(document)} className="shrink-0 rounded-full text-accent-foreground hover:bg-accent"><Trash2 className="size-4" aria-hidden="true" /></Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <StatusMark status={document.status} testId={`document-${document.id}`} />
        {document.status === "review" && document.file_id && <a data-testid={`document-view-${document.id}`} href={`/api/applicant/documents/${document.id}/view`} target="_blank" rel="noopener noreferrer" aria-label={`View ${document.title} in a new tab`} className={`${buttonVariants({ variant: "outline", size: "sm" })} rounded-full`}><Eye className="mr-1 size-3.5" aria-hidden="true" />View</a>}
        {document.status === "review" && !document.file_id && <span data-testid={`document-unavailable-${document.id}`} className="text-xs text-muted-foreground">File unavailable</span>}
        {document.status === "rejected" && <Button data-testid={`document-resubmit-${document.id}`} size="sm" variant="outline" disabled={!canResubmit} onClick={() => onResubmit(document)} className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"><UploadCloud className="mr-1 size-3.5" aria-hidden="true" />Resubmit</Button>}
      </div>
      {document.status === "rejected" && <p data-testid={`document-rejection-message-${document.id}`} className="mt-3 border-t border-destructive/20 pt-3 text-xs leading-5 text-destructive">Document not accepted. Please resubmit.{!canResubmit && " Switch to the employment pathway to resubmit this document, or remove it."}</p>}
    </div>
  );
}

function RemoveDocumentDialog({ document, onClose, onConfirm, isRemoving }: { document: ApplicantDocument | null; onClose: () => void; onConfirm: () => void; isRemoving: boolean }) {
  return (
    <Dialog open={Boolean(document)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent data-testid="remove-document-dialog" className="border-[#d5d1c9] bg-[#fdfcf9] sm:max-w-md">
        <DialogHeader>
          <div data-testid="remove-document-icon" className="mb-2 flex size-10 items-center justify-center rounded-xl bg-[#f4e6df] text-[#a66350]"><Trash2 className="size-5" aria-hidden="true" /></div>
          <DialogTitle data-testid="remove-document-title" className="font-heading text-2xl font-extrabold text-[#2c3b2e]">Remove this document?</DialogTitle>
          <DialogDescription data-testid="remove-document-description" className="leading-6 text-[#5c6b5e]">{document ? `${document.title} will be removed from your applicant profile${document.file_id ? " and its stored file will be deleted" : ""}.` : "This document will be removed."}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button data-testid="remove-document-cancel-button" type="button" variant="ghost" onClick={onClose} className="rounded-full text-[#5c6b5e] hover:bg-[#ebe9e4] hover:text-[#2c3b2e]">Keep document</Button>
          <Button data-testid="remove-document-confirm-button" type="button" disabled={isRemoving} onClick={onConfirm} className="rounded-full bg-[#a66350] px-6 text-white hover:bg-[#8f503f] disabled:opacity-50">{isRemoving ? "Removing…" : "Remove document"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConsultationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("10:00");
  const [booking, setBooking] = useState<ConsultationBooking | null>(null);

  const bookingMutation = useMutation({
    mutationFn: (payload: ConsultationCreate) => apiPost<ConsultationBooking>("/applicant/consultations", payload),
    onSuccess: (confirmedBooking) => setBooking(confirmedBooking),
    onError: () => toast.error("Could not book consultation", { description: "Choose today or a future date and try again." }),
  });

  const changeOpen = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setBooking(null);
      setPreferredDate("");
      setPreferredTime("10:00");
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent data-testid="consultation-dialog" className="border-[#d5d1c9] bg-[#fdfcf9] sm:max-w-md">
        {booking ? (
          <div data-testid="consultation-confirmation" className="py-3 text-center">
            <span data-testid="consultation-confirmation-icon" className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#e8efe9] text-[#4a6b53]"><CheckCircle2 className="size-7" aria-hidden="true" /></span>
            <DialogHeader className="mt-5">
              <DialogTitle data-testid="consultation-confirmation-title" className="text-center font-heading text-2xl font-extrabold text-[#2c3b2e]">Your consultation is booked</DialogTitle>
              <DialogDescription data-testid="consultation-confirmation-description" className="text-center leading-6 text-[#5c6b5e]">An Educaro specialist will meet you on {booking.preferred_date} at {booking.preferred_time}.</DialogDescription>
            </DialogHeader>
            <Button data-testid="consultation-confirmation-close-button" onClick={() => changeOpen(false)} className="mt-6 rounded-full bg-[#4a6b53] px-8 text-white hover:bg-[#3a5541]">Done</Button>
          </div>
        ) : (
          <form data-testid="consultation-form" onSubmit={(event) => { event.preventDefault(); bookingMutation.mutate({ preferred_date: preferredDate, preferred_time: preferredTime }); }}>
            <DialogHeader>
              <p data-testid="consultation-dialog-overline" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a66350]">Consultant handoff</p>
              <DialogTitle data-testid="consultation-dialog-title" className="font-heading text-2xl font-extrabold text-[#2c3b2e]">Choose a preferred time</DialogTitle>
              <DialogDescription data-testid="consultation-dialog-description" className="leading-6 text-[#5c6b5e]">Pick a date and time for your pathway consultation. Your booking will be confirmed here.</DialogDescription>
            </DialogHeader>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="consultation-date" data-testid="consultation-date-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Preferred date</label>
                <Input id="consultation-date" data-testid="consultation-date-input" type="date" required value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="h-11 border-[#d5d1c9] bg-white focus-visible:ring-[#4a6b53]" />
              </div>
              <div>
                <label htmlFor="consultation-time" data-testid="consultation-time-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Preferred time</label>
                <select id="consultation-time" data-testid="consultation-time-select" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} className="h-11 w-full rounded-md border border-[#d5d1c9] bg-white px-3 text-sm text-[#2c3b2e] outline-none focus:border-[#4a6b53] focus:ring-2 focus:ring-[#4a6b53]/20">
                  {["09:00", "10:00", "11:30", "14:00", "16:00"].map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button data-testid="consultation-cancel-button" type="button" variant="ghost" onClick={() => changeOpen(false)} className="rounded-full text-[#5c6b5e] hover:bg-[#ebe9e4] hover:text-[#2c3b2e]">Cancel</Button>
              <Button data-testid="consultation-submit-button" type="submit" disabled={!preferredDate || bookingMutation.isPending} className="rounded-full bg-[#4a6b53] px-6 text-white hover:bg-[#3a5541] disabled:opacity-50">{bookingMutation.isPending ? "Booking…" : "Confirm consultation"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AgentChatCard({ profile }: { profile: ApplicantProfile }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [streamError, setStreamError] = useState("");
  const suggestions = [
    "What should I do next for my study pathway?",
    "Which document would strengthen my profile most?",
    "How can I prepare for Germany while learning German?",
  ];

  const agentMutation = useMutation({
    mutationFn: async ({ query }: AgentQuery) => {
      let fullAnswer = "";
      let providerError = "";
      setAnswer("");
      setStreamError("");
      await apiStream<AgentStreamEvent>("/agent/query/stream", { query }, (event) => {
        if (event.type === "delta") {
          fullAnswer += event.content;
          setAnswer(fullAnswer);
        }
        if (event.type === "error") providerError = event.content;
      });
      if (providerError) throw new Error(providerError);
      return fullAnswer;
    },
    onSuccess: () => setQuestion(""),
    onError: (error) => setStreamError(error instanceof Error ? error.message : "The live agent could not answer right now."),
  });

  const ask = (value: string) => {
    const query = value.trim();
    if (query.length < 2 || agentMutation.isPending) return;
    agentMutation.mutate({ query });
  };

  return (
    <Card data-testid="agent-chat-card" className="soft-rise soft-rise-delay-1 mt-6 overflow-hidden border-[#d5d1c9] bg-[#fdfcf9] p-0 shadow-none">
      <div className="flex flex-col gap-4 border-b border-[#ebe9e4] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-3">
          <div data-testid="agent-chat-icon" className="flex size-10 items-center justify-center rounded-xl bg-[#4a6b53] text-white"><MessageCircle className="size-5" aria-hidden="true" /></div>
          <div><p data-testid="agent-chat-overline" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#879087]">Ask your agent</p><h2 data-testid="agent-chat-title" className="mt-1 font-heading text-xl font-extrabold tracking-tight text-[#2c3b2e]">A real answer, grounded in your profile</h2></div>
        </div>
        <span data-testid="agent-chat-provider" className="inline-flex w-fit items-center gap-2 rounded-full border border-[#c9d7ca] bg-[#edf4ee] px-3 py-1.5 text-xs font-semibold text-[#4a6b53]"><span className="size-1.5 rounded-full bg-[#4a6b53]" /> AICredits · GPT-5.4</span>
      </div>
      <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p data-testid="agent-chat-description" className="text-sm leading-6 text-[#5c6b5e]">Ask about your pathway, missing evidence, language preparation, or what to do next. The agent sees the profile you have built here.</p>
          <div data-testid="agent-chat-suggestions" className="mt-5 space-y-2">
            {suggestions.map((suggestion, index) => <button type="button" key={suggestion} data-testid={`agent-chat-suggestion-${index + 1}`} onClick={() => { setQuestion(suggestion); ask(suggestion); }} className="group flex w-full items-center justify-between rounded-xl border border-[#ebe9e4] bg-white/70 px-3 py-2.5 text-left text-xs font-semibold text-[#5c6b5e] hover:-translate-y-0.5 hover:border-[#b9c5ba] hover:bg-[#edf4ee] hover:text-[#2c3b2e]"><span data-testid={`agent-chat-suggestion-label-${index + 1}`}>{suggestion}</span><ArrowUpRight className="size-3.5 shrink-0 text-[#879087] group-hover:text-[#4a6b53]" aria-hidden="true" /></button>)}
          </div>
        </div>
        <div>
          <form data-testid="agent-chat-form" onSubmit={(event) => { event.preventDefault(); ask(question); }} className="flex items-end gap-2 rounded-2xl border border-[#d5d1c9] bg-white p-2 shadow-sm focus-within:border-[#4a6b53] focus-within:ring-2 focus-within:ring-[#4a6b53]/10">
            <textarea data-testid="agent-chat-input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask what your next best step is…" className="min-h-16 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm leading-6 text-[#2c3b2e] outline-none placeholder:text-[#9ca39c]" />
            <Button data-testid="agent-chat-submit-button" type="submit" disabled={agentMutation.isPending || question.trim().length < 2} size="icon" className="size-10 shrink-0 rounded-xl bg-[#4a6b53] text-white hover:bg-[#3a5541] disabled:opacity-50"><Send className="size-4" aria-hidden="true" /><span className="sr-only">Ask agent</span></Button>
          </form>
          {agentMutation.isPending && <p data-testid="agent-chat-streaming-status" className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#a66350]"><span className="size-1.5 animate-pulse rounded-full bg-[#c27a65]" /> Reading your profile and thinking…</p>}
          {streamError && <p data-testid="agent-chat-error" className="mt-3 text-xs font-semibold text-[#a66350]">{streamError}</p>}
          {answer && <div data-testid="agent-chat-answer" className="mt-4 rounded-2xl bg-[#f1f5f1] p-5"><div className="flex items-center gap-2"><Sparkles className="size-4 text-[#4a6b53]" aria-hidden="true" /><p data-testid="agent-chat-answer-label" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4a6b53]">Educaro agent</p></div><p data-testid="agent-chat-answer-content" className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#2c3b2e]">{answer}</p><p data-testid="agent-chat-answer-context" className="mt-4 border-t border-[#dce8de] pt-3 text-[11px] text-[#879087]">Grounded in {profile.name}’s current profile · Applicant facts are kept distinct from recommendations</p></div>}
        </div>
      </div>
    </Card>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("Overview");
  const [showIntake, setShowIntake] = useState(false);
  const [showDocumentPanel, setShowDocumentPanel] = useState(false);
  const [showConsultation, setShowConsultation] = useState(false);
  const [documentToRemove, setDocumentToRemove] = useState<ApplicantDocument | null>(null);
  const [documentToResubmit, setDocumentToResubmit] = useState<ApplicantDocument | null>(null);
  const applicantQuery = useQuery({ queryKey: ["applicant"], queryFn: () => apiGet<ApplicantProfile>("/applicant"), retry: false, refetchInterval: 10_000 });
  const profile = applicantQuery.data ?? demoProfile;

  const intakeMutation = useMutation({
    mutationFn: (payload: ApplicantIntake) => apiPost<ApplicantProfile>("/applicant/intake", payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["applicant"], updated);
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      queryClient.invalidateQueries({ queryKey: ["admin-booked-profiles"] });
      setShowIntake(false);
      toast.success("Profile scan complete", { description: "Your agent has refreshed the qualification view." });
    },
    onError: () => toast.error("The scan could not finish", { description: "Your workspace is still available. Try again in a moment." }),
  });

  const documentMutation = useMutation({
    mutationFn: ({ kind, file, document_id }: DocumentUploadInput) => {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("file", file);
      return apiUpload<ApplicantProfile>(document_id ? `/applicant/documents/${document_id}/resubmit` : "/applicant/documents/upload", formData);
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(["applicant"], updated);
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      queryClient.invalidateQueries({ queryKey: ["admin-booked-profiles"] });
      setShowDocumentPanel(false);
      setDocumentToResubmit(null);
      toast.success(variables.document_id ? "Document resubmitted" : "Document uploaded", { description: "Your file is securely stored and awaiting admin review." });
    },
    onError: () => toast.error("Could not add document", { description: "Please try again." }),
  });

  const removeDocumentMutation = useMutation({
    mutationFn: (documentId: string) => apiDelete<ApplicantProfile>(`/applicant/documents/${documentId}`),
    onSuccess: (updated) => {
      queryClient.setQueryData(["applicant"], updated);
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      queryClient.invalidateQueries({ queryKey: ["admin-booked-profiles"] });
      setDocumentToRemove(null);
      toast.success("Document removed", { description: "The profile and qualification view have been refreshed." });
    },
    onError: () => toast.error("Could not remove document", { description: "Please try again." }),
  });

  const PathwayIcon = pathwayIcons[profile.pathway];
  const firstName = useMemo(() => profile.name.split(" ")[0], [profile.name]);
  const completionStroke = Math.max(0, Math.min(100, profile.profile_completion));
  const hasMissingDocuments = profile.required_document_kinds.some((kind) => !profile.documents.some((document) => document.kind === kind && document.file_id && document.status !== "rejected"));

  const goTo = (section: string) => {
    setActiveSection(section);
    const target = section === "Documents" ? "documents-section" : section === "Qualification" ? "qualification-section" : "overview-section";
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div data-testid="educaro-app-shell" className="min-h-svh bg-[#f9f8f6] text-[#2c3b2e]">
      <div className="flex min-h-svh flex-col lg:flex-row">
        <aside data-testid="app-sidebar" className="hidden w-[248px] shrink-0 flex-col border-r border-[#d5d1c9] bg-[#ebe9e4] p-5 lg:flex">
          <div data-testid="brand-lockup" className="flex items-center gap-2 px-2 py-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#4a6b53] text-white"><Leaf className="size-5" aria-hidden="true" /></span>
            <span data-testid="brand-name" className="font-heading text-xl font-extrabold tracking-tight text-[#2c3b2e]">educaro</span>
          </div>
          <div data-testid="journey-context" className="mt-10 px-2">
            <p data-testid="journey-context-overline" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#879087]">Applicant workspace</p>
            <p data-testid="journey-context-title" className="mt-2 text-sm font-semibold text-[#2c3b2e]">Your Germany journey</p>
          </div>
          <nav data-testid="main-navigation" className="mt-7 space-y-1">
            {[
              { label: "Overview", icon: ClipboardCheck },
              { label: "Documents", icon: FileText },
              { label: "Qualification", icon: Sparkles },
              { label: "Profile", icon: UserRound },
            ].map(({ label, icon: Icon }) => {
              const selected = activeSection === label;
              return (
                <button key={label} type="button" data-testid={`nav-${label.toLowerCase()}-button`} onClick={() => label === "Profile" ? setShowIntake(true) : goTo(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${selected ? "bg-[#f9f8f6] text-[#2c3b2e] shadow-sm" : "text-[#5c6b5e] hover:bg-[#f3f1ed] hover:text-[#2c3b2e]"}`}>
                  <Icon className={`size-4 ${selected ? "text-[#4a6b53]" : "text-[#879087]"}`} aria-hidden="true" />
                  <span data-testid={`nav-${label.toLowerCase()}-label`}>{label}</span>
                  {selected && <span data-testid={`nav-${label.toLowerCase()}-active-mark`} className="ml-auto size-1.5 rounded-full bg-[#c27a65]" />}
                </button>
              );
            })}
          </nav>
          <div data-testid="sidebar-agent-card" className="mt-auto rounded-2xl bg-[#4a6b53] p-4 text-white">
            <div className="flex items-center gap-2"><span data-testid="sidebar-agent-status-dot" className="size-2 rounded-full bg-[#d4a373]" /><span data-testid="sidebar-agent-status" className="text-xs font-semibold">Agent online</span></div>
            <p data-testid="sidebar-agent-copy" className="mt-3 text-sm leading-5 text-white/80">I’ll keep your next step clear, not complicated.</p>
            <button type="button" data-testid="sidebar-help-button" onClick={() => toast.info("Your Educaro agent is following your profile progress.")} className="mt-4 inline-flex items-center text-xs font-semibold text-white hover:text-[#f8e7d9]">How it works <ArrowUpRight className="ml-1 size-3" aria-hidden="true" /></button>
          </div>
        </aside>

        <main data-testid="main-content" className="min-w-0 flex-1">
          <header data-testid="app-header" className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#d5d1c9]/80 bg-[#f9f8f6]/85 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#4a6b53] text-white lg:hidden"><Leaf className="size-5" aria-hidden="true" /></div>
              <div><p data-testid="header-title" className="font-heading text-sm font-extrabold text-[#2c3b2e] sm:text-base">Applicant journey</p><p data-testid="header-subtitle" className="hidden text-xs text-[#879087] sm:block">One clear route to your next step in Germany</p></div>
            </div>
            <div className="flex items-center gap-3">
              <span data-testid="header-live-status" className="hidden items-center gap-2 rounded-full border border-[#c9d7ca] bg-[#edf4ee] px-3 py-1.5 text-xs font-semibold text-[#4a6b53] sm:inline-flex"><span className="size-1.5 rounded-full bg-[#4a6b53]" /> Agent ready</span>
              <button type="button" data-testid="header-profile-button" onClick={() => setShowIntake(true)} className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#4a6b53]/50">
                <img data-testid="header-avatar-image" src={studentAvatar} alt="Applicant portrait" className="size-9 rounded-full object-cover ring-2 ring-[#f9f8f6]" />
                <span data-testid="header-profile-initials" className="hidden text-sm font-semibold text-[#2c3b2e] sm:block">{initials(profile.name)}</span>
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1480px] p-5 sm:p-8 lg:p-10">
            <section id="overview-section" data-testid="overview-section" className="soft-rise grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <Card data-testid="welcome-card" className="relative overflow-hidden border-[#d5d1c9] bg-[#f1f5f1] p-6 shadow-none sm:p-9">
                <div className="absolute -right-16 -top-20 size-64 rounded-full border-[24px] border-[#dce8de] opacity-70" />
                <div className="absolute -bottom-32 right-14 size-72 rounded-full border-[1px] border-[#c9d7ca] opacity-80" />
                <div className="relative max-w-2xl">
                  <p data-testid="welcome-overline" className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#a66350]">Good progress, {firstName}</p>
                  <h1 data-testid="welcome-title" className="font-heading text-3xl font-extrabold tracking-tight text-[#2c3b2e] sm:text-5xl">A calmer way to find your next step in Germany.</h1>
                  <p data-testid="welcome-description" className="mt-5 max-w-xl text-base leading-7 text-[#5c6b5e]">Your agent is turning your story, evidence and goals into a route you can trust — with every decision grounded in what you provide.</p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button data-testid="continue-intake-button" onClick={() => setShowIntake(true)} className="rounded-full bg-[#4a6b53] px-5 text-white hover:-translate-y-0.5 hover:bg-[#3a5541]">Continue intake <ArrowUpRight className="ml-2 size-4" aria-hidden="true" /></Button>
                    <span data-testid="last-updated-label" className="inline-flex items-center gap-2 text-xs font-medium text-[#879087]"><Clock3 className="size-3.5" aria-hidden="true" /> Last updated today</span>
                  </div>
                </div>
              </Card>

              <Card data-testid="profile-progress-card" className="border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-none sm:p-8">
                <div className="flex items-start justify-between"><div><p data-testid="profile-progress-overline" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#879087]">Profile health</p><p data-testid="profile-progress-label" className="mt-2 text-sm font-semibold text-[#2c3b2e]">Ready for a stronger match</p></div><div data-testid="profile-progress-icon" className="flex size-9 items-center justify-center rounded-full bg-[#f4e6df] text-[#a66350]"><Sparkles className="size-4" aria-hidden="true" /></div></div>
                <div className="mt-7 flex items-center gap-5">
                  <div data-testid="profile-progress-ring" className="relative flex size-28 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--ring) ${completionStroke}%, var(--secondary) 0)` }}>
                    <div className="flex size-[88px] items-center justify-center rounded-full bg-[#fdfcf9]"><span data-testid="profile-progress-value" className="font-heading text-2xl font-extrabold text-[#2c3b2e]">{completionStroke}%</span></div>
                  </div>
                  <div><p data-testid="profile-progress-body" className="text-sm leading-6 text-[#5c6b5e]">A few verified details will help the agent route you with confidence.</p><button type="button" data-testid="profile-progress-action" onClick={() => setShowIntake(true)} className="mt-3 text-sm font-bold text-[#4a6b53] hover:text-[#3a5541]">Complete profile <ChevronRight className="ml-1 inline size-4" aria-hidden="true" /></button></div>
                </div>
              </Card>
            </section>

            <section data-testid="journey-overview-section" className="mt-6 grid gap-4 md:grid-cols-3">
              <Card data-testid="pathway-summary-card" className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><div className="flex items-center justify-between"><span data-testid="pathway-summary-label" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879087]">Your pathway</span><PathwayIcon data-testid="pathway-summary-icon" className="size-4 text-[#4a6b53]" aria-hidden="true" /></div><p data-testid="pathway-summary-value" className="mt-4 font-heading text-lg font-extrabold text-[#2c3b2e]">{formatPathway(profile.pathway)}</p><p data-testid="pathway-summary-city" className="mt-1 flex items-center gap-1 text-xs text-[#879087]"><MapPin className="size-3" aria-hidden="true" /> {profile.city}</p></Card>
              <Card data-testid="evidence-summary-card" className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><div className="flex items-center justify-between"><span data-testid="evidence-summary-label" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879087]">Evidence mapped</span><FileText className="size-4 text-[#c27a65]" aria-hidden="true" /></div><p data-testid="evidence-summary-value" className="mt-4 font-heading text-lg font-extrabold text-[#2c3b2e]">{profile.documents.length} documents</p><p data-testid="evidence-summary-status" className="mt-1 text-xs text-[#879087]">{profile.documents.filter((doc) => doc.status === "verified").length} verified by admin</p></Card>
              <Card data-testid="qualification-summary-card" className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><div className="flex items-center justify-between"><span data-testid="qualification-summary-label" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879087]">Qualification signal</span><ClipboardCheck className="size-4 text-[#4a6b53]" aria-hidden="true" /></div><p data-testid="qualification-summary-value" className="mt-4 font-heading text-lg font-extrabold text-[#2c3b2e]">{profile.qualification_status === "ready" ? "Ready" : "Needs review"}</p><p data-testid="qualification-summary-status" className="mt-1 text-xs text-[#879087]">{profile.missing_items.length} open requirement{profile.missing_items.length === 1 ? "" : "s"}</p></Card>
            </section>

            <AgentChatCard profile={profile} />

            <div className="mt-10 grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card data-testid="agent-recommendation-card" className="soft-rise soft-rise-delay-1 overflow-hidden border-[#d5d1c9] bg-[#fdfcf9] p-0 shadow-none">
                <div className="flex items-center justify-between border-b border-[#ebe9e4] px-6 py-5 sm:px-7"><div className="flex items-center gap-3"><div data-testid="agent-recommendation-icon" className="flex size-9 items-center justify-center rounded-xl bg-[#e8efe9] text-[#4a6b53]"><Sparkles className="size-4" aria-hidden="true" /></div><div><p data-testid="agent-recommendation-overline" className="text-xs font-semibold uppercase tracking-[0.17em] text-[#879087]">Agent recommendation</p><p data-testid="agent-recommendation-title" className="mt-1 text-sm font-bold text-[#2c3b2e]">The route I’d take next</p></div></div><Badge data-testid="agent-recommendation-badge" className="bg-[#f4e6df] text-[#8f503f] hover:bg-[#f4e6df]">{profile.qualification_status === "ready" ? "Ready" : "In progress"}</Badge></div>
                <div data-testid="recommendation-body" className="p-6 sm:p-7"><p data-testid="recommendation-copy" className="max-w-xl font-heading text-2xl font-extrabold leading-tight tracking-tight text-[#2c3b2e]">{profile.recommended_next_step}</p><p data-testid="recommendation-detail" className="mt-4 max-w-xl text-sm leading-6 text-[#5c6b5e]">The agent compares your stated pathway with the evidence you have shared, then flags only the gaps that change your recommendation.</p><div className="mt-7 flex flex-wrap gap-3"><Button data-testid="recommendation-primary-button" onClick={() => { if (profile.missing_items.length === 0) setShowConsultation(true); else if (hasMissingDocuments) setShowDocumentPanel(true); else setShowIntake(true); }} className="rounded-full bg-[#4a6b53] text-white hover:-translate-y-0.5 hover:bg-[#3a5541]">{profile.missing_items.length > 0 ? "Close the next gap" : "Book consultation"}<ArrowUpRight className="ml-2 size-4" aria-hidden="true" /></Button><button type="button" data-testid="recommendation-secondary-button" onClick={() => goTo("Qualification")} className="rounded-full px-4 text-sm font-bold text-[#4a6b53] hover:bg-[#edf4ee]">See the reasoning <ChevronRight className="ml-1 inline size-4" aria-hidden="true" /></button></div></div>
              </Card>

              <Card id="qualification-section" data-testid="qualification-card" className="soft-rise soft-rise-delay-2 border-[#d5d1c9] bg-[#2c3b2e] p-6 text-white shadow-none sm:p-7">
                <div className="flex items-center justify-between"><p data-testid="qualification-card-overline" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d7ca]">Qualification view</p><span data-testid="qualification-card-icon" className="flex size-8 items-center justify-center rounded-full bg-white/10"><ClipboardCheck className="size-4 text-[#d4a373]" aria-hidden="true" /></span></div>
                <div className="mt-8"><p data-testid="qualification-card-label" className="text-sm font-semibold text-white/65">Current signal</p><p data-testid="qualification-card-value" className="mt-2 font-heading text-3xl font-extrabold tracking-tight">{profile.qualification_label}</p><div data-testid="qualification-progress-track" className="mt-7 h-2 overflow-hidden rounded-full bg-white/15"><div data-testid="qualification-progress-fill" className="h-full rounded-full bg-[#d4a373]" style={{ width: `${completionStroke}%` }} /></div><div className="mt-3 flex justify-between text-xs"><span data-testid="qualification-progress-caption" className="text-white/65">Profile completeness</span><span data-testid="qualification-progress-number" className="font-mono text-[#f8e7d9]">{completionStroke}%</span></div></div>
                <div className="mt-8 border-t border-white/10 pt-6"><p data-testid="qualification-missing-title" className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Open requirements</p><div data-testid="qualification-missing-list" className="mt-4 space-y-3">{profile.missing_items.map((item) => <div data-testid={`missing-item-${item.slice(0, 8).replaceAll(" ", "-").toLowerCase()}`} key={item} className="flex items-start gap-2 text-sm text-white/80"><AlertCircle className="mt-0.5 size-4 shrink-0 text-[#d4a373]" aria-hidden="true" /><span data-testid={`missing-item-label-${item.slice(0, 8).replaceAll(" ", "-").toLowerCase()}`}>{item}</span></div>)}{profile.missing_items.length === 0 && <div data-testid="qualification-all-clear" className="flex items-center gap-2 text-sm text-white/80"><Check className="size-4 text-[#d4a373]" /> All key requirements are mapped.</div>}</div></div>
              </Card>
            </div>

            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card id="documents-section" data-testid="documents-card" className="soft-rise soft-rise-delay-2 border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-none sm:p-7">
                <div className="flex items-start justify-between gap-4"><div><p data-testid="documents-overline" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#879087]">Evidence locker</p><h2 data-testid="documents-title" className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-[#2c3b2e]">Documents that tell your story</h2><p data-testid="documents-description" className="mt-2 text-sm leading-6 text-[#5c6b5e]">Everything stays clearly marked as applicant-provided or agent-generated.</p></div><Button data-testid="add-document-button" variant="outline" onClick={() => setShowDocumentPanel(true)} className="shrink-0 rounded-full border-[#b9c5ba] text-[#4a6b53] hover:bg-[#edf4ee] hover:text-[#3a5541]"><Plus className="mr-1.5 size-4" aria-hidden="true" /> <span className="hidden sm:inline">Add document</span><span className="sm:hidden">Add</span></Button></div>
                <div className="mt-5"><RequiredDocuments profile={profile} testId="applicant-required-documents" /></div>
                <p data-testid="document-preview-policy" className="mt-4 text-xs leading-5 text-muted-foreground">You can view files awaiting review. Accepted files are marked verified; rejected files need a replacement.</p>
                <div data-testid="documents-list" className="mt-4 space-y-2">{profile.documents.map((document) => <DocumentRow key={document.id} document={document} onRemove={setDocumentToRemove} canResubmit={profile.required_document_kinds.includes(document.kind)} onResubmit={(rejected) => { setDocumentToResubmit(rejected); setShowDocumentPanel(true); }} />)}</div>
                <button type="button" data-testid="documents-view-all-button" onClick={() => setShowDocumentPanel(true)} className="mt-5 text-sm font-bold text-[#4a6b53] hover:text-[#3a5541]">Add another document <ChevronRight className="ml-1 inline size-4" aria-hidden="true" /></button>
              </Card>

              <Card data-testid="agent-trace-card" className="soft-rise soft-rise-delay-3 border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-none sm:p-7">
                <div className="flex items-center justify-between"><div><p data-testid="agent-trace-overline" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#879087]">Agent trace</p><h2 data-testid="agent-trace-title" className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-[#2c3b2e]">How I got here</h2></div><div data-testid="agent-trace-badge" className="rounded-full bg-[#edf4ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4a6b53]">Live view</div></div>
                <div data-testid="agent-trace-list" className="mt-7 space-y-0">{profile.agent_steps.map((step, index) => <div data-testid={`agent-step-${index + 1}`} key={step.label} className="relative flex gap-3 pb-6 last:pb-0"><div className="relative flex w-5 shrink-0 justify-center">{index < profile.agent_steps.length - 1 && <span data-testid={`agent-step-connector-${index + 1}`} className="absolute top-5 h-full w-px bg-[#d5d1c9]" />}{step.status === "complete" ? <span data-testid={`agent-step-complete-${index + 1}`} className="z-10 flex size-5 items-center justify-center rounded-full bg-[#4a6b53] text-white"><Check className="size-3" aria-hidden="true" /></span> : step.status === "active" ? <span data-testid={`agent-step-active-${index + 1}`} className="z-10 flex size-5 items-center justify-center rounded-full border-2 border-[#c27a65] bg-[#fdfcf9]"><span className="size-1.5 rounded-full bg-[#c27a65]" /></span> : <Circle data-testid={`agent-step-pending-${index + 1}`} className="z-10 size-5 fill-[#ebe9e4] text-[#b9b7b0]" />}</div><div><p data-testid={`agent-step-label-${index + 1}`} className={`text-sm font-semibold ${step.status === "pending" ? "text-[#879087]" : "text-[#2c3b2e]"}`}>{step.label}</p><p data-testid={`agent-step-detail-${index + 1}`} className="mt-1 text-xs leading-5 text-[#879087]">{step.detail}</p></div></div>)}</div>
              </Card>
            </div>

            <Card data-testid="applicant-summary-card" className="mt-6 border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-none sm:p-7"><div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><img data-testid="applicant-summary-avatar" src={studentAvatar} alt="Applicant portrait" className="size-14 rounded-2xl object-cover" /><div><p data-testid="applicant-summary-name" className="font-heading text-xl font-extrabold text-[#2c3b2e]">{profile.name}</p><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#879087]"><span data-testid="applicant-summary-email"><Mail className="mr-1 inline size-3" aria-hidden="true" />{profile.email}</span><span data-testid="applicant-summary-location"><MapPin className="mr-1 inline size-3" aria-hidden="true" />{profile.city}</span><span data-testid="applicant-summary-language"><Languages className="mr-1 inline size-3" aria-hidden="true" />German {profile.german_level}</span></div></div></div><div className="flex items-center gap-5"><div><p data-testid="applicant-summary-education-label" className="text-xs text-[#879087]">Education</p><p data-testid="applicant-summary-education" className="mt-1 text-sm font-semibold text-[#2c3b2e]">{profile.education}</p></div><button type="button" data-testid="edit-profile-button" onClick={() => setShowIntake(true)} className="flex size-9 items-center justify-center rounded-full border border-[#d5d1c9] text-[#4a6b53] hover:-translate-y-0.5 hover:bg-[#edf4ee]"><ArrowUpRight className="size-4" aria-hidden="true" /><span className="sr-only">Edit profile</span></button></div></div></Card>
          </div>
        </main>
      </div>
      {showIntake && <IntakePanel profile={profile} onClose={() => setShowIntake(false)} onSubmit={(payload) => intakeMutation.mutate(payload)} isSubmitting={intakeMutation.isPending} />}
      {showDocumentPanel && <DocumentPanel profile={profile} resubmission={documentToResubmit} onClose={() => { setShowDocumentPanel(false); setDocumentToResubmit(null); }} onSubmit={(payload) => documentMutation.mutate(payload)} isSubmitting={documentMutation.isPending} />}
      <ConsultationDialog open={showConsultation} onOpenChange={setShowConsultation} />
      <RemoveDocumentDialog document={documentToRemove} onClose={() => setDocumentToRemove(null)} onConfirm={() => { if (documentToRemove) removeDocumentMutation.mutate(documentToRemove.id); }} isRemoving={removeDocumentMutation.isPending} />
    </div>
  );
}