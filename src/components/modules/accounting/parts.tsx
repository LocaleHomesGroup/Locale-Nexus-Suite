"use client";

import * as React from "react";
import { Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Dash } from "@/components/ui/table";
import { money, type PaymentMethod } from "@/components/modules/employee/data";
import { php } from "./fx";
import { methodSummary, personOf } from "./data";

/**
 * Pieces the Accounting sections share: who a row is about, how they're
 * paid, and a figure in both currencies.
 */

/** Avatar, name and position. "(you)" marks the previewed employee. */
export function PersonCell({ id, you, className }: { id: string; you?: boolean; className?: string }) {
  const p = personOf(id);
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar name={p.name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">
          {p.name}
          {you ? <span className="font-normal text-subtle-foreground"> (preview)</span> : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{p.role}</span>
      </span>
    </span>
  );
}

/** "Wise · msoriano@hotmail.com". A dim dash when there's nothing on file. */
export function MethodCell({ method }: { method: PaymentMethod | null }) {
  const m = methodSummary(method);
  if (!m) return <Dash />;
  const Icon = method?.processor === "wise" ? Wallet : Landmark;
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate">{m.label}</span>
        {m.detail ? <span className="block truncate font-mono text-[11px] text-muted-foreground">{m.detail}</span> : null}
      </span>
    </span>
  );
}

/**
 * The invoice's AUD with what it pays in pesos under it (HRIS's PHP-over-USD
 * stack, the other way up: Locale's invoices are in AUD). No rate yet, no pesos.
 */
export function AudPhp({ aud, peso, className }: { aud: number; peso: number | null; className?: string }) {
  return (
    <span className={cn("flex flex-col items-end leading-tight tabular-nums", className)}>
      <span className="font-semibold">{money(aud)}</span>
      <span className="text-xs text-muted-foreground">{peso == null ? "₱ not set" : `≈ ${php(peso)}`}</span>
    </span>
  );
}
