import { CheckCircle2, Circle } from "lucide-react";
import type { ApplicantProfile, DocumentKind } from "@/lib/types";

export const documentLabels: Record<DocumentKind, string> = {
  degree: "Degree certificate",
  language: "Language certificate",
  cv: "Current CV",
  experience: "Experience letter",
};

export function RequiredDocuments({ profile, testId }: { profile: ApplicantProfile; testId: string }) {
  const uploaded = new Set(profile.documents.filter((document) => document.file_id && document.status !== "rejected").map((document) => document.kind));
  const rejected = new Set(profile.documents.filter((document) => document.status === "rejected").map((document) => document.kind));
  const required = profile.required_document_kinds;
  const completed = required.filter((kind) => uploaded.has(kind)).length;

  return (
    <div data-testid={testId} className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p data-testid={`${testId}-title`} className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Required documents</p>
        <span data-testid={`${testId}-count`} className="text-xs font-semibold text-foreground">{completed} of {required.length} uploaded</span>
      </div>
      <p data-testid={`${testId}-description`} className="mt-2 text-xs leading-5 text-muted-foreground">
        Degree and language certificates are compulsory for every pathway.{profile.pathway === "employment" ? " Employment also requires a current CV and experience letter." : " CV and experience letter apply only to employment."}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {required.map((kind) => (
          <li key={kind} data-testid={`${testId}-${kind}`} className="flex items-start gap-2 text-xs leading-5">
            {uploaded.has(kind) ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#a9d6ba]" /> : <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
            <span data-testid={`${testId}-${kind}-label`} className="text-foreground">{documentLabels[kind]}<span data-testid={`${testId}-${kind}-status`} className={`block ${!uploaded.has(kind) && rejected.has(kind) ? "text-destructive" : "text-muted-foreground"}`}>{uploaded.has(kind) ? "Uploaded" : rejected.has(kind) ? "Not accepted · resubmit" : "Required · not uploaded"}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}