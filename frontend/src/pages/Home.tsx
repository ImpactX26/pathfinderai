import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  Languages,
  Leaf,
  Mail,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import type {
  ApplicantDocument,
  ApplicantIntake,
  ApplicantProfile,
  DocumentCreate,
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
    { id: "degree", kind: "degree", title: "B.Tech Computer Science.pdf", status: "verified", source: "applicant-provided" },
    { id: "language", kind: "language", title: "IELTS Academic certificate.pdf", status: "verified", source: "applicant-provided" },
  ],
  profile_completion: 63,
  qualification_status: "needs-review",
  qualification_label: "Almost ready — a few details needed",
  missing_items: ["German language level B1 or above", "Current CV", "Motivation for Germany"],
  recommended_next_step: "Add your current CV to unlock your recommendation",
  agent_steps: [
    { label: "Profile assembled", detail: "Applicant-provided details structured", status: "complete" },
    { label: "Evidence mapped", detail: "2 supporting documents linked", status: "complete" },
    { label: "Requirements checked", detail: "3 open requirements found", status: "active" },
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

const documentLabels: Record<DocumentKind, string> = {
  degree: "Degree / certificate",
  language: "Language certificate",
  cv: "Current CV",
  experience: "Experience letter",
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

function StatusMark({ status, testId }: { status: "verified" | "review"; testId: string }) {
  return status === "verified" ? (
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

        <form data-testid="intake-form" className="mt-8 space-y-6" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
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

          <div className="grid gap-4 sm:grid-cols-3">
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
            <div>
              <label htmlFor="experience-years" data-testid="experience-field-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Experience (years)</label>
              <Input id="experience-years" data-testid="intake-experience-input" type="number" min="0" max="50" value={form.experience_years} onChange={(event) => update("experience_years", Number(event.target.value))} className="h-11 border-[#d5d1c9] bg-white focus-visible:ring-[#4a6b53]" />
            </div>
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

function DocumentPanel({ onClose, onSubmit, isSubmitting }: { onClose: () => void; onSubmit: (payload: DocumentCreate) => void; isSubmitting: boolean }) {
  const [kind, setKind] = useState<DocumentKind>("cv");
  const [title, setTitle] = useState("Aarav Mehta — CV.pdf");
  return (
    <div data-testid="document-panel-overlay" className="fixed inset-0 z-50 flex items-end justify-end bg-[#2c3b2e]/25 p-0 backdrop-blur-[2px] sm:p-5">
      <div data-testid="document-panel" className="w-full rounded-t-3xl border border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p data-testid="document-panel-overline" className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#a66350]">Evidence locker</p>
            <h2 data-testid="document-panel-title" className="font-heading text-2xl font-extrabold tracking-tight text-[#2c3b2e]">Add a document</h2>
            <p data-testid="document-panel-description" className="mt-2 text-sm leading-6 text-[#5c6b5e]">For this prototype, label the file you want the agent to review next.</p>
          </div>
          <Button data-testid="document-panel-close-button" variant="ghost" size="icon" onClick={onClose} className="rounded-full text-[#5c6b5e] hover:bg-[#ebe9e4] hover:text-[#2c3b2e]"><X className="size-5" aria-hidden="true" /><span className="sr-only">Close document panel</span></Button>
        </div>
        <form data-testid="document-form" className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); onSubmit({ kind, title }); }}>
          <div data-testid="upload-dropzone" className="rounded-2xl border border-dashed border-[#b9c5ba] bg-[#f1f5f1] p-6 text-center">
            <UploadCloud className="mx-auto mb-3 size-8 text-[#4a6b53]" aria-hidden="true" />
            <p data-testid="upload-dropzone-title" className="text-sm font-semibold text-[#2c3b2e]">Document ready for review</p>
            <p data-testid="upload-dropzone-description" className="mt-1 text-xs text-[#5c6b5e]">Agent classification is simulated for this demo.</p>
          </div>
          <div>
            <label htmlFor="document-kind" data-testid="document-kind-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Document type</label>
            <select id="document-kind" data-testid="document-kind-select" value={kind} onChange={(event) => setKind(event.target.value as DocumentKind)} className="h-11 w-full rounded-md border border-[#d5d1c9] bg-white px-3 text-sm text-[#2c3b2e] outline-none focus:border-[#4a6b53] focus:ring-2 focus:ring-[#4a6b53]/20">
              {(Object.keys(documentLabels) as DocumentKind[]).map((option) => <option key={option} value={option}>{documentLabels[option]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="document-title" data-testid="document-title-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">File name</label>
            <Input id="document-title" data-testid="document-title-input" value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 border-[#d5d1c9] bg-white focus-visible:ring-[#4a6b53]" />
          </div>
          <Button data-testid="document-submit-button" type="submit" disabled={isSubmitting || title.trim().length < 2} className="w-full rounded-full bg-[#4a6b53] text-white hover:-translate-y-0.5 hover:bg-[#3a5541] disabled:opacity-60">{isSubmitting ? "Adding to evidence locker…" : "Add for agent review"}</Button>
        </form>
      </div>
    </div>
  );
}

function DocumentRow({ document }: { document: ApplicantDocument }) {
  return (
    <div data-testid={`document-row-${document.id}`} className="flex items-center gap-3 rounded-xl border border-[#ebe9e4] bg-white/70 p-3">
      <div data-testid={`document-icon-${document.id}`} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f4e6df] text-[#a66350]"><FileText className="size-4" aria-hidden="true" /></div>
      <div className="min-w-0 flex-1">
        <p data-testid={`document-title-${document.id}`} className="truncate text-sm font-semibold text-[#2c3b2e]">{document.title}</p>
        <p data-testid={`document-type-${document.id}`} className="mt-0.5 text-xs text-[#879087]">{documentLabels[document.kind]} · {document.source === "applicant-provided" ? "Applicant provided" : "Agent generated"}</p>
      </div>
      <StatusMark status={document.status} testId={`document-${document.id}`} />
    </div>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("Overview");
  const [showIntake, setShowIntake] = useState(false);
  const [showDocumentPanel, setShowDocumentPanel] = useState(false);
  const applicantQuery = useQuery({ queryKey: ["applicant"], queryFn: () => apiGet<ApplicantProfile>("/applicant"), retry: false });
  const profile = applicantQuery.data ?? demoProfile;

  const intakeMutation = useMutation({
    mutationFn: (payload: ApplicantIntake) => apiPost<ApplicantProfile>("/applicant/intake", payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["applicant"], updated);
      setShowIntake(false);
      toast.success("Profile scan complete", { description: "Your agent has refreshed the qualification view." });
    },
    onError: () => toast.error("The scan could not finish", { description: "Your workspace is still available. Try again in a moment." }),
  });

  const documentMutation = useMutation({
    mutationFn: (payload: DocumentCreate) => apiPost<ApplicantProfile>("/applicant/documents", payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["applicant"], updated);
      setShowDocumentPanel(false);
      toast.success("Document added", { description: "The evidence is now in the agent review queue." });
    },
    onError: () => toast.error("Could not add document", { description: "Please try again." }),
  });

  const PathwayIcon = pathwayIcons[profile.pathway];
  const firstName = useMemo(() => profile.name.split(" ")[0], [profile.name]);
  const completionStroke = Math.max(0, Math.min(100, profile.profile_completion));

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
                  <div data-testid="profile-progress-ring" className="relative flex size-28 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#4a6b53 ${completionStroke}%, #e3e1db 0)` }}>
                    <div className="flex size-[88px] items-center justify-center rounded-full bg-[#fdfcf9]"><span data-testid="profile-progress-value" className="font-heading text-2xl font-extrabold text-[#2c3b2e]">{completionStroke}%</span></div>
                  </div>
                  <div><p data-testid="profile-progress-body" className="text-sm leading-6 text-[#5c6b5e]">A few verified details will help the agent route you with confidence.</p><button type="button" data-testid="profile-progress-action" onClick={() => setShowIntake(true)} className="mt-3 text-sm font-bold text-[#4a6b53] hover:text-[#3a5541]">Complete profile <ChevronRight className="ml-1 inline size-4" aria-hidden="true" /></button></div>
                </div>
              </Card>
            </section>

            <section data-testid="journey-overview-section" className="mt-6 grid gap-4 md:grid-cols-3">
              <Card data-testid="pathway-summary-card" className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><div className="flex items-center justify-between"><span data-testid="pathway-summary-label" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879087]">Your pathway</span><PathwayIcon data-testid="pathway-summary-icon" className="size-4 text-[#4a6b53]" aria-hidden="true" /></div><p data-testid="pathway-summary-value" className="mt-4 font-heading text-lg font-extrabold text-[#2c3b2e]">{formatPathway(profile.pathway)}</p><p data-testid="pathway-summary-city" className="mt-1 flex items-center gap-1 text-xs text-[#879087]"><MapPin className="size-3" aria-hidden="true" /> {profile.city}</p></Card>
              <Card data-testid="evidence-summary-card" className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><div className="flex items-center justify-between"><span data-testid="evidence-summary-label" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879087]">Evidence mapped</span><FileText className="size-4 text-[#c27a65]" aria-hidden="true" /></div><p data-testid="evidence-summary-value" className="mt-4 font-heading text-lg font-extrabold text-[#2c3b2e]">{profile.documents.length} documents</p><p data-testid="evidence-summary-status" className="mt-1 text-xs text-[#879087]">{profile.documents.filter((doc) => doc.status === "verified").length} verified by you</p></Card>
              <Card data-testid="qualification-summary-card" className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><div className="flex items-center justify-between"><span data-testid="qualification-summary-label" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#879087]">Qualification signal</span><ClipboardCheck className="size-4 text-[#4a6b53]" aria-hidden="true" /></div><p data-testid="qualification-summary-value" className="mt-4 font-heading text-lg font-extrabold text-[#2c3b2e]">{profile.qualification_status === "ready" ? "Ready" : "Needs review"}</p><p data-testid="qualification-summary-status" className="mt-1 text-xs text-[#879087]">{profile.missing_items.length} open requirement{profile.missing_items.length === 1 ? "" : "s"}</p></Card>
            </section>

            <div className="mt-10 grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card data-testid="agent-recommendation-card" className="soft-rise soft-rise-delay-1 overflow-hidden border-[#d5d1c9] bg-[#fdfcf9] p-0 shadow-none">
                <div className="flex items-center justify-between border-b border-[#ebe9e4] px-6 py-5 sm:px-7"><div className="flex items-center gap-3"><div data-testid="agent-recommendation-icon" className="flex size-9 items-center justify-center rounded-xl bg-[#e8efe9] text-[#4a6b53]"><Sparkles className="size-4" aria-hidden="true" /></div><div><p data-testid="agent-recommendation-overline" className="text-xs font-semibold uppercase tracking-[0.17em] text-[#879087]">Agent recommendation</p><p data-testid="agent-recommendation-title" className="mt-1 text-sm font-bold text-[#2c3b2e]">The route I’d take next</p></div></div><Badge data-testid="agent-recommendation-badge" className="bg-[#f4e6df] text-[#8f503f] hover:bg-[#f4e6df]">{profile.qualification_status === "ready" ? "Ready" : "In progress"}</Badge></div>
                <div data-testid="recommendation-body" className="p-6 sm:p-7"><p data-testid="recommendation-copy" className="max-w-xl font-heading text-2xl font-extrabold leading-tight tracking-tight text-[#2c3b2e]">{profile.recommended_next_step}</p><p data-testid="recommendation-detail" className="mt-4 max-w-xl text-sm leading-6 text-[#5c6b5e]">The agent compares your stated pathway with the evidence you have shared, then flags only the gaps that change your recommendation.</p><div className="mt-7 flex flex-wrap gap-3"><Button data-testid="recommendation-primary-button" onClick={() => profile.missing_items.length > 0 && profile.missing_items.some((item) => item.toLowerCase().includes("cv")) ? setShowDocumentPanel(true) : setShowIntake(true)} className="rounded-full bg-[#4a6b53] text-white hover:-translate-y-0.5 hover:bg-[#3a5541]">{profile.missing_items.length > 0 ? "Close the next gap" : "Book consultation"}<ArrowUpRight className="ml-2 size-4" aria-hidden="true" /></Button><button type="button" data-testid="recommendation-secondary-button" onClick={() => goTo("Qualification")} className="rounded-full px-4 text-sm font-bold text-[#4a6b53] hover:bg-[#edf4ee]">See the reasoning <ChevronRight className="ml-1 inline size-4" aria-hidden="true" /></button></div></div>
              </Card>

              <Card id="qualification-section" data-testid="qualification-card" className="soft-rise soft-rise-delay-2 border-[#d5d1c9] bg-[#2c3b2e] p-6 text-white shadow-none sm:p-7">
                <div className="flex items-center justify-between"><p data-testid="qualification-card-overline" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d7ca]">Qualification view</p><span data-testid="qualification-card-icon" className="flex size-8 items-center justify-center rounded-full bg-white/10"><ClipboardCheck className="size-4 text-[#d4a373]" aria-hidden="true" /></span></div>
                <div className="mt-8"><p data-testid="qualification-card-label" className="text-sm font-semibold text-white/65">Current signal</p><p data-testid="qualification-card-value" className="mt-2 font-heading text-3xl font-extrabold tracking-tight">{profile.qualification_label}</p><div data-testid="qualification-progress-track" className="mt-7 h-2 overflow-hidden rounded-full bg-white/15"><div data-testid="qualification-progress-fill" className="h-full rounded-full bg-[#d4a373]" style={{ width: `${completionStroke}%` }} /></div><div className="mt-3 flex justify-between text-xs"><span data-testid="qualification-progress-caption" className="text-white/65">Profile completeness</span><span data-testid="qualification-progress-number" className="font-mono text-[#f8e7d9]">{completionStroke}%</span></div></div>
                <div className="mt-8 border-t border-white/10 pt-6"><p data-testid="qualification-missing-title" className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Open requirements</p><div data-testid="qualification-missing-list" className="mt-4 space-y-3">{profile.missing_items.slice(0, 3).map((item) => <div data-testid={`missing-item-${item.slice(0, 8).replaceAll(" ", "-").toLowerCase()}`} key={item} className="flex items-start gap-2 text-sm text-white/80"><AlertCircle className="mt-0.5 size-4 shrink-0 text-[#d4a373]" aria-hidden="true" /><span data-testid={`missing-item-label-${item.slice(0, 8).replaceAll(" ", "-").toLowerCase()}`}>{item}</span></div>)}{profile.missing_items.length === 0 && <div data-testid="qualification-all-clear" className="flex items-center gap-2 text-sm text-white/80"><Check className="size-4 text-[#d4a373]" /> All key requirements are mapped.</div>}</div></div>
              </Card>
            </div>

            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card id="documents-section" data-testid="documents-card" className="soft-rise soft-rise-delay-2 border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-none sm:p-7">
                <div className="flex items-start justify-between gap-4"><div><p data-testid="documents-overline" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#879087]">Evidence locker</p><h2 data-testid="documents-title" className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-[#2c3b2e]">Documents that tell your story</h2><p data-testid="documents-description" className="mt-2 text-sm leading-6 text-[#5c6b5e]">Everything stays clearly marked as applicant-provided or agent-generated.</p></div><Button data-testid="add-document-button" variant="outline" onClick={() => setShowDocumentPanel(true)} className="shrink-0 rounded-full border-[#b9c5ba] text-[#4a6b53] hover:bg-[#edf4ee] hover:text-[#3a5541]"><Plus className="mr-1.5 size-4" aria-hidden="true" /> <span className="hidden sm:inline">Add document</span><span className="sm:hidden">Add</span></Button></div>
                <div data-testid="documents-list" className="mt-6 space-y-2">{profile.documents.map((document) => <DocumentRow key={document.id} document={document} />)}</div>
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
      {showDocumentPanel && <DocumentPanel onClose={() => setShowDocumentPanel(false)} onSubmit={(payload) => documentMutation.mutate(payload)} isSubmitting={documentMutation.isPending} />}
    </div>
  );
}