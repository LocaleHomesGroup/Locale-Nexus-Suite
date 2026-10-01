import type { PillTone } from "@/components/ui/pill";
import type { ClaimStatus, InvoiceStatus } from "./data";

/**
 * Status → verdict tone (UI guide § 1: status colours carry verdicts). The
 * mockup drew Draft / Awaiting in mist, Approved in seafoam and Paid in ghost;
 * here waiting is amber, approved is emerald, and a paid item — settled,
 * nothing left to do — steps back to neutral.
 */
export const INVOICE_TONE: Record<InvoiceStatus, PillTone> = {
  Draft: "pending",
  Approved: "ok",
  Paid: "neutral",
};

export const CLAIM_TONE: Record<ClaimStatus, PillTone> = {
  "Awaiting approval": "pending",
  Approved: "ok",
  Paid: "neutral",
  Declined: "problem",
};
