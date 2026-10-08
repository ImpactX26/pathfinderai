import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Database,
  FileText,
  GraduationCap,
  Leaf,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import { beginSession, endSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { AdminBookedProfile, AdminSession, Pathway } from "@/lib/types";


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


function AdminLoginCard() {
  const [pin, setPin] = useState("");
  const loginMutation = useMutation({
    mutationFn: () => apiPost<AdminSession>("/admin/login", { pin }),
    onSuccess: () => {
      beginSession();
      window.location.assign("/admin");
    },
    onError: () => toast.error("Incorrect admin PIN", { description: "Check the PIN and try again." }),
  });

  return (
    <Card data-testid="admin-login-card" className="w-full max-w-md border-[#d5d1c9] bg-[#fdfcf9] p-7 shadow-xl shadow-[#2c3b2e]/5 sm:p-9">
      <div data-testid="admin-login-icon" className="flex size-12 items-center justify-center rounded-2xl bg-[#4a6b53] text-white"><LockKeyhole className="size-5" aria-hidden="true" /></div>
      <p data-testid="admin-login-overline" className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-[#a66350]">Protected workspace</p>
      <h1 data-testid="admin-login-title" className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-[#2c3b2e]">Educaro admin</h1>
      <p data-testid="admin-login-description" className="mt-3 text-sm leading-6 text-[#5c6b5e]">Enter the admin PIN to view applicants who booked a consultation and their document records.</p>
      <form data-testid="admin-login-form" className="mt-7 space-y-4" onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }}>
        <div>
          <label htmlFor="admin-pin" data-testid="admin-pin-label" className="mb-2 block text-sm font-semibold text-[#2c3b2e]">Admin PIN</label>
          <Input id="admin-pin" data-testid="admin-pin-input" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Enter PIN" className="h-12 border-[#d5d1c9] bg-white text-center font-mono text-lg tracking-[0.35em] focus-visible:ring-[#4a6b53]" />
        </div>
        <Button data-testid="admin-login-submit-button" type="submit" disabled={pin.length < 4 || loginMutation.isPending} className="h-11 w-full rounded-full bg-[#4a6b53] text-white hover:-translate-y-0.5 hover:bg-[#3a5541] disabled:opacity-50">{loginMutation.isPending ? "Unlocking…" : "Open admin panel"}</Button>
      </form>
      <Link data-testid="admin-login-back-link" to="/" className={cn(buttonVariants({ variant: "ghost" }), "mt-3 w-full rounded-full text-[#5c6b5e] hover:bg-[#ebe9e4] hover:text-[#2c3b2e]")}><ArrowLeft className="mr-2 size-4" aria-hidden="true" /> Back to applicant journey</Link>
    </Card>
  );
}


function ProfileRecord({ record }: { record: AdminBookedProfile }) {
  const { applicant, latest_consultation: consultation } = record;
  const PathwayIcon = pathwayIcons[applicant.pathway];
  return (
    <Card data-testid={`admin-profile-card-${applicant.id}`} className="overflow-hidden border-[#d5d1c9] bg-[#fdfcf9] p-0 shadow-none">
      <div className="flex flex-col gap-5 border-b border-[#ebe9e4] p-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <span data-testid={`admin-profile-avatar-${applicant.id}`} className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8efe9] font-heading text-sm font-extrabold text-[#4a6b53]">{applicant.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 data-testid={`admin-profile-name-${applicant.id}`} className="font-heading text-xl font-extrabold text-[#2c3b2e]">{applicant.name}</h2><Badge data-testid={`admin-profile-status-${applicant.id}`} className="bg-[#edf4ee] text-[#4a6b53] hover:bg-[#edf4ee]">Consultation booked</Badge></div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#879087]"><span data-testid={`admin-profile-email-${applicant.id}`}><Mail className="mr-1 inline size-3" aria-hidden="true" />{applicant.email}</span><span data-testid={`admin-profile-city-${applicant.id}`}><MapPin className="mr-1 inline size-3" aria-hidden="true" />{applicant.city}</span></div>
          </div>
        </div>
        <div data-testid={`admin-consultation-summary-${applicant.id}`} className="rounded-xl border border-[#d5d1c9] bg-white px-4 py-3 md:text-right">
          <p data-testid={`admin-consultation-date-${applicant.id}`} className="text-sm font-bold text-[#2c3b2e]">{consultation.preferred_date} · {consultation.preferred_time}</p>
          <p data-testid={`admin-consultation-count-${applicant.id}`} className="mt-1 text-xs text-[#879087]">{record.consultation_count} booking{record.consultation_count === 1 ? "" : "s"} on record</p>
        </div>
      </div>
      <div className="grid gap-6 p-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p data-testid={`admin-profile-details-title-${applicant.id}`} className="text-xs font-semibold uppercase tracking-[0.18em] text-[#879087]">Applicant profile</p>
          <div className="mt-4 space-y-3 text-sm">
            <div data-testid={`admin-profile-pathway-${applicant.id}`} className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-[#edf4ee] text-[#4a6b53]"><PathwayIcon className="size-4" aria-hidden="true" /></span><div><p className="text-xs text-[#879087]">Pathway</p><p className="font-semibold text-[#2c3b2e]">{pathwayLabels[applicant.pathway]}</p></div></div>
            <div data-testid={`admin-profile-education-${applicant.id}`} className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-[#f4e6df] text-[#a66350]"><GraduationCap className="size-4" aria-hidden="true" /></span><div><p className="text-xs text-[#879087]">Education</p><p className="font-semibold text-[#2c3b2e]">{applicant.education}</p></div></div>
            <p data-testid={`admin-profile-language-${applicant.id}`} className="rounded-xl bg-[#f6f4ef] p-3 text-xs leading-5 text-[#5c6b5e]">German {applicant.german_level} · English {applicant.english_level} · {applicant.profile_completion}% complete</p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between"><p data-testid={`admin-documents-title-${applicant.id}`} className="text-xs font-semibold uppercase tracking-[0.18em] text-[#879087]">Document records</p><span data-testid={`admin-documents-count-${applicant.id}`} className="text-xs font-semibold text-[#4a6b53]">{applicant.documents.length} available</span></div>
          <div data-testid={`admin-documents-list-${applicant.id}`} className="mt-4 space-y-2">
            {applicant.documents.length > 0 ? applicant.documents.map((document) => <div data-testid={`admin-document-${document.id}`} key={document.id} className="flex items-center gap-3 rounded-xl border border-[#ebe9e4] bg-white p-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f4e6df] text-[#a66350]"><FileText className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p data-testid={`admin-document-title-${document.id}`} className="truncate text-sm font-semibold text-[#2c3b2e]">{document.title}</p><p data-testid={`admin-document-source-${document.id}`} className="mt-0.5 text-xs text-[#879087]">{document.source === "applicant-provided" ? "Applicant provided" : "Agent generated"}</p></div><span data-testid={`admin-document-status-${document.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#4a6b53]"><ShieldCheck className="size-3.5" aria-hidden="true" />{document.status}</span></div>) : <p data-testid={`admin-documents-empty-${applicant.id}`} className="rounded-xl border border-dashed border-[#d5d1c9] p-5 text-center text-sm text-[#879087]">No document records available.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}


export default function Admin() {
  const sessionQuery = useQuery({ queryKey: ["admin-session"], queryFn: () => apiGet<AdminSession>("/admin/session"), retry: false });
  const authenticated = sessionQuery.data?.authenticated === true;
  const profilesQuery = useQuery({ queryKey: ["admin-booked-profiles"], queryFn: () => apiGet<AdminBookedProfile[]>("/admin/booked-profiles"), enabled: authenticated, retry: false });
  const logoutMutation = useMutation({ mutationFn: () => endSession() });

  if (!authenticated) {
    return <main data-testid="admin-login-page" className="flex min-h-svh items-center justify-center bg-[#f1f0ec] p-5"><AdminLoginCard /></main>;
  }

  const records = profilesQuery.data ?? [];
  const totalDocuments = records.reduce((sum, record) => sum + record.applicant.documents.length, 0);

  return (
    <div data-testid="admin-dashboard-page" className="min-h-svh bg-[#f9f8f6] text-[#2c3b2e]">
      <header data-testid="admin-header" className="sticky top-0 z-30 border-b border-[#d5d1c9] bg-[#f9f8f6]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div data-testid="admin-brand" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-[#4a6b53] text-white"><Leaf className="size-5" aria-hidden="true" /></span><div><p data-testid="admin-brand-name" className="font-heading font-extrabold">educaro admin</p><p data-testid="admin-brand-caption" className="text-xs text-[#879087]">Consultation operations</p></div></div>
          <div className="flex items-center gap-2"><Link data-testid="admin-back-link" to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full text-[#5c6b5e] hover:bg-[#ebe9e4] hover:text-[#2c3b2e]")}><ArrowLeft className="mr-1.5 size-4" aria-hidden="true" /> Applicant view</Link><Button data-testid="admin-logout-button" variant="outline" size="sm" onClick={() => logoutMutation.mutate()} className="rounded-full border-[#d5d1c9] text-[#5c6b5e] hover:bg-[#f4e6df] hover:text-[#8f503f]"><LogOut className="mr-1.5 size-4" aria-hidden="true" /> Sign out</Button></div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-5 sm:p-8">
        <section data-testid="admin-dashboard-intro" className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <Card className="border-[#d5d1c9] bg-[#2c3b2e] p-7 text-white shadow-none sm:p-9"><p data-testid="admin-dashboard-overline" className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4a373]">Booked applicant profiles</p><h1 data-testid="admin-dashboard-title" className="mt-3 max-w-2xl font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">The people ready for an Educaro conversation.</h1><p data-testid="admin-dashboard-description" className="mt-4 max-w-xl text-sm leading-6 text-white/65">Review the latest consultation preference, profile context and applicant-provided document records in one protected workspace.</p></Card>
          <Card data-testid="admin-storage-card" className="border-[#d5d1c9] bg-[#fdfcf9] p-6 shadow-none"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-[#edf4ee] text-[#4a6b53]"><Database className="size-4" aria-hidden="true" /></span><div><p data-testid="admin-storage-title" className="text-sm font-bold text-[#2c3b2e]">MongoDB · database “app”</p><p data-testid="admin-storage-location" className="mt-1 text-xs text-[#879087]">Stored in the Emergent app pod</p></div></div><p data-testid="admin-storage-note" className="mt-5 text-xs leading-5 text-[#5c6b5e]">Profile and consultation records are persisted in MongoDB. Current document entries are metadata records; binary file storage is not connected yet.</p></Card>
        </section>
        <section data-testid="admin-stats" className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><UsersRound className="size-4 text-[#4a6b53]" aria-hidden="true" /><p data-testid="admin-profile-count" className="mt-4 font-heading text-3xl font-extrabold">{records.length}</p><p data-testid="admin-profile-count-label" className="mt-1 text-xs text-[#879087]">Booked applicants</p></Card>
          <Card className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><CalendarDays className="size-4 text-[#c27a65]" aria-hidden="true" /><p data-testid="admin-booking-count" className="mt-4 font-heading text-3xl font-extrabold">{records.reduce((sum, record) => sum + record.consultation_count, 0)}</p><p data-testid="admin-booking-count-label" className="mt-1 text-xs text-[#879087]">Consultation bookings</p></Card>
          <Card className="border-[#d5d1c9] bg-[#fdfcf9] p-5 shadow-none"><FileText className="size-4 text-[#d4a373]" aria-hidden="true" /><p data-testid="admin-document-count" className="mt-4 font-heading text-3xl font-extrabold">{totalDocuments}</p><p data-testid="admin-document-count-label" className="mt-1 text-xs text-[#879087]">Document records</p></Card>
        </section>
        <section data-testid="admin-profiles-section" className="mt-8 space-y-4">
          <div><p data-testid="admin-profiles-overline" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#879087]">Consultation queue</p><h2 data-testid="admin-profiles-title" className="mt-2 font-heading text-2xl font-extrabold tracking-tight">Booked profiles</h2></div>
          {profilesQuery.isPending ? <Card data-testid="admin-profiles-loading" className="border-[#d5d1c9] bg-[#fdfcf9] p-8 text-sm text-[#879087] shadow-none">Loading booked profiles…</Card> : records.length > 0 ? records.map((record) => <ProfileRecord key={record.applicant.id} record={record} />) : <Card data-testid="admin-profiles-empty" className="border-dashed border-[#d5d1c9] bg-[#fdfcf9] p-10 text-center shadow-none"><UsersRound className="mx-auto size-8 text-[#879087]" aria-hidden="true" /><p className="mt-4 font-semibold">No consultation bookings yet.</p></Card>}
        </section>
      </main>
    </div>
  );
}