import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Eye, FileText, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiPatch } from "@/lib/api";
import type { AdminDocumentDecision, ApplicantDocument } from "@/lib/types";

export function AdminDocumentRow({ document }: { document: ApplicantDocument }) {
  const queryClient = useQueryClient();
  const decisionMutation = useMutation({
    mutationFn: (decision: AdminDocumentDecision["decision"]) => {
      if (!document.file_id) throw new Error("This document has no stored file");
      const payload: AdminDocumentDecision = { decision, file_id: document.file_id };
      return apiPatch<ApplicantDocument>(`/admin/documents/${document.id}/decision`, payload);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-booked-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      toast.success(updated.status === "verified" ? "Document accepted and verified" : "Document rejected", {
        description: updated.status === "rejected" ? "The applicant will be asked to resubmit this document." : "The applicant will see the verified status.",
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-booked-profiles"] });
      toast.error("Could not save the decision", { description: "The file may have changed or your session expired. Refresh and try again." });
    },
  });
  const verified = document.status === "verified";
  const rejected = document.status === "rejected";
  const Icon = verified ? ShieldCheck : rejected ? X : Clock3;

  return (
    <div data-testid={`admin-document-${document.id}`} className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><FileText className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p data-testid={`admin-document-title-${document.id}`} className="break-words text-sm font-semibold text-foreground">{document.title}</p>
          <p data-testid={`admin-document-source-${document.id}`} className="mt-0.5 text-xs text-muted-foreground">{document.source === "applicant-provided" ? "Applicant provided" : "Agent generated"}{document.file_size ? ` · ${(document.file_size / 1024).toFixed(1)} KB` : " · Metadata only"}</p>
        </div>
        <span data-testid={`admin-document-status-${document.id}`} className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${verified ? "text-[#a9d6ba]" : rejected ? "text-destructive" : "text-accent-foreground"}`}><Icon className="size-3.5" aria-hidden="true" />{verified ? "Verified" : rejected ? "Rejected" : "In review"}</span>
      </div>
      {rejected && <p data-testid={`admin-document-rejection-${document.id}`} className="mt-3 text-xs text-destructive">Not accepted · awaiting applicant resubmission</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {document.file_id ? <>
          <a data-testid={`admin-document-view-${document.id}`} href={`/api/admin/documents/${document.id}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${document.title} in a new tab`} className={`${buttonVariants({ variant: "outline", size: "sm" })} rounded-full`}><Eye className="mr-1 size-3.5" aria-hidden="true" />View</a>
          <Button data-testid={`admin-document-accept-${document.id}`} size="sm" disabled={decisionMutation.isPending || verified} onClick={() => decisionMutation.mutate("accept")} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/80"><Check className="mr-1 size-3.5" aria-hidden="true" />{decisionMutation.isPending && decisionMutation.variables === "accept" ? "Accepting…" : "Accept"}</Button>
          <Button data-testid={`admin-document-reject-${document.id}`} size="sm" variant="outline" disabled={decisionMutation.isPending || rejected} onClick={() => decisionMutation.mutate("reject")} className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"><X className="mr-1 size-3.5" aria-hidden="true" />{decisionMutation.isPending && decisionMutation.variables === "reject" ? "Rejecting…" : "Reject"}</Button>
        </> : <span data-testid={`admin-document-unavailable-${document.id}`} className="text-xs text-muted-foreground">File unavailable · cannot review</span>}
      </div>
    </div>
  );
}