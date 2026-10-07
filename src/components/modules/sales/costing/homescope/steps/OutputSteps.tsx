"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Download, ExternalLink, FileText, Loader2, Pencil, RotateCcw, Settings2 } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { HOMES_ARCH, LOCALE_HOMES_LOGO } from "@/lib/brand-marks";
import { downloadBlob, pathBounds } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Field, Switch, Textarea } from "@/components/ui/input";
import { stepIndex } from "../catalogue";
import { siteVariationLines } from "../pricing";
import { NEXT_STEPS, frontageText, modelMeta, money, quoteDoc, type QuoteDoc } from "../quote-doc";
import { colourLabel, goToStep, markGenerated, setPdf, startOver, useEstimate } from "../store";
import { Panel, PanelTitle, Segmented, signed } from "../parts";
import { PriceBox } from "./PriceSteps";

/* ── Step 11: Summary ──────────────────────────────────────────────────── */

function SummaryCard({ title, onEdit, children, className }: { title: string; onEdit?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={className}>
      <PanelTitle
        right={
          onEdit ? (
            <Button size="xs" variant="ghost" onClick={onEdit}>
              <Pencil /> Edit
            </Button>
          ) : null
        }
      >
        {title}
      </PanelTitle>
      {children}
    </Panel>
  );
}

function Rows({ rows }: { rows: { label: string; value: React.ReactNode; step?: number }[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline gap-3 border-t border-hairline py-1.5 first:border-t-0">
          <dt className="w-36 shrink-0 text-xs text-muted-foreground">{r.label}</dt>
          <dd className="min-w-0 flex-1 text-[13px] text-pretty">{r.value || <span className="text-subtle-foreground">Not set</span>}</dd>
          {r.step != null ? (
            <Button size="icon-xs" variant="ghost" aria-label={`Change ${r.label.toLowerCase()}`} onClick={() => goToStep(r.step!)}>
              <Pencil />
            </Button>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** Step 11: HomeScope's Complete Estimate Summary, every section with a way back to its step. */
export function SummaryStep() {
  const { estimate: e, pricing: p, quoteNo, dirty, saved } = useEstimate();
  const site = siteVariationLines(e, p);
  const people = e.contacts.filter((c) => c.firstName || c.lastName);
  const savedQuote = quoteNo ? saved.find((q) => q.no === quoteNo) : null;

  return (
    <div className="flex flex-col gap-4">
      {savedQuote ? (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            dirty
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
          )}
        >
          {dirty
            ? `Changed since ${quoteNo} was saved. Save again to update it.`
            : `Saved as ${quoteNo} by ${savedQuote.by}, ${new Date(savedQuote.savedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.`}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard title="Client information" onEdit={() => goToStep(stepIndex("client"))}>
          <Rows
            rows={[
              ...people.flatMap((c, i) => [
                { label: people.length > 1 ? `Client ${i + 1}` : "Name", value: `${c.firstName} ${c.lastName}` },
                { label: "Email", value: c.email },
                { label: "Phone", value: c.phone },
              ]),
              { label: "Site address", value: e.address },
              { label: "Frontage", value: frontageText(e) },
              { label: "Total lot size", value: e.lotSize ? `${e.lotSize} m²` : "" },
              { label: "Prepared by", value: e.staff ?? "" },
            ]}
          />
        </SummaryCard>
        <SummaryCard title="Project specifications">
          <Rows
            rows={[
              { label: "Builder", value: p.builder?.name, step: stepIndex("builder") },
              { label: "Model", value: [p.model?.name, modelMeta(p)].filter(Boolean).join(" · "), step: stepIndex("model") },
              { label: "Site cost option", value: p.siteCostLabel, step: stepIndex("siteCosts") },
              { label: "Spec range", value: p.range ? `${p.range.name} (${p.range.level})` : "", step: stepIndex("range") },
              { label: "Front elevation", value: e.elevation ?? "", step: stepIndex("elevation") },
              { label: "Colour scheme", value: colourLabel(e), step: stepIndex("colour") },
            ]}
          />
        </SummaryCard>
      </div>

      <section>
        <PanelTitle
          right={
            <Button size="xs" variant="ghost" onClick={() => goToStep(stepIndex("pricing"))}>
              <Pencil /> Edit
            </Button>
          }
        >
          Pricing breakdown
        </PanelTitle>
        <PriceBox />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard title="Selected variations" onEdit={() => goToStep(stepIndex("variations"))}>
          {e.lines.length ? (
            <ul className="flex flex-col">
              {e.lines.map((l) => (
                <li key={l.id} className="flex items-baseline gap-3 border-t border-hairline py-1.5 text-[13px] first:border-t-0">
                  <span className="min-w-0 flex-1 text-pretty">
                    {l.description}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {l.inclusion === "include" ? "Charge" : "Credit"} · qty {l.qty}
                      {l.source === "boltOn" ? " · bolt-on" : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{signed(l.amount, l.inclusion === "include" ? "+" : "−")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">None selected.</p>
          )}
        </SummaryCard>
        <SummaryCard title="Site cost variations" onEdit={() => goToStep(stepIndex("siteVariations"))}>
          {site.length ? (
            <ul className="flex flex-col">
              {site.map((l) => (
                <li key={l.label} className="flex items-baseline gap-3 border-t border-hairline py-1.5 text-[13px] first:border-t-0">
                  <span className="min-w-0 flex-1 text-tone-ink">{l.label}</span>
                  {l.note ? <span className="text-xs text-muted-foreground">in base</span> : null}
                  <span className="tabular-nums">{aud(l.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">None on this estimate.</p>
          )}
        </SummaryCard>
      </div>

      <Panel className="bg-tone-soft/40">
        <h3 className="text-sm font-semibold">Next steps</h3>
        <p className="mt-1 max-w-[70ch] text-[13px] text-muted-foreground">{NEXT_STEPS.intro}</p>
        <ul className="mt-1.5 flex flex-col gap-0.5 text-[13px]">
          {NEXT_STEPS.bullets.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ── Step 12: Quote PDF ────────────────────────────────────────────────── */

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/** Step 12: choose what the quote shows, see it, and download the Locale Homes PDF. */
export function PdfStep() {
  const { estimate: e, pricing: p, quoteNo, pdf, generatedAt } = useEstimate();
  const reduce = useReducedMotion();
  const [busy, setBusy] = React.useState<"download" | "preview" | null>(null);
  const [last, setLast] = React.useState<{ name: string; pages: number; size: number; branded: boolean } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const doc = React.useMemo(() => quoteDoc(e, p, pdf, quoteNo ?? "Draft"), [e, p, pdf, quoteNo]);

  const generate = async (mode: "download" | "preview") => {
    setBusy(mode);
    setError(null);
    // A preview tab has to open inside the click, before the PDF is ready.
    const tab = mode === "preview" ? window.open("", "_blank") : null;
    try {
      const { quotePdf } = await import("../quote-pdf");
      const out = await quotePdf(quoteDoc(e, p, pdf, quoteNo ?? "Draft", new Date()));
      if (mode === "download") {
        downloadBlob(out.blob, doc.fileName);
        markGenerated();
        confirm("Quote PDF downloaded", `${doc.fileName} · ${out.pages} page${out.pages === 1 ? "" : "s"}`);
      } else if (tab) {
        tab.location.href = URL.createObjectURL(out.blob);
      }
      setLast({ name: doc.fileName, pages: out.pages, size: out.blob.size, branded: out.branded });
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : "The PDF couldn't be generated.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Panel className="flex flex-col gap-4">
        <PanelTitle icon={Settings2}>What the quote shows</PanelTitle>
        <ToggleRow label="Itemise the variations" hint="Each variation with its type, quantity and amount" checked={pdf.itemised} onChange={(itemised) => setPdf({ itemised })} />
        <ToggleRow label="Show the site cost breakdown" hint="Title allowance, BAL, coastal and noise lines" checked={pdf.siteBreakdown} onChange={(siteBreakdown) => setPdf({ siteBreakdown })} />
        <Field label="Valid for">
          <Segmented
            label="Valid for"
            value={String(pdf.validDays)}
            onChange={(v) => setPdf({ validDays: Number(v) })}
            options={[
              { value: "14", label: "14 days" },
              { value: "30", label: "30 days" },
              { value: "60", label: "60 days" },
            ]}
          />
        </Field>
        <Field label="Notes for the client" htmlFor="hs-notes" hint="Printed under the variations, in your words.">
          <Textarea
            id="hs-notes"
            rows={4}
            value={pdf.notes}
            placeholder="e.g. Price includes the Finishing Touch promotion. Lot hold expires Friday."
            onChange={(ev) => setPdf({ notes: ev.target.value })}
          />
        </Field>
        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <Button size="lg" variant="brand" disabled={busy != null} onClick={() => generate("download")}>
            {busy === "download" ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Download />}
            {busy === "download" ? "Generating…" : "Download PDF"}
          </Button>
          <Button variant="outline" disabled={busy != null} onClick={() => generate("preview")}>
            {busy === "preview" ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <ExternalLink />}
            Open in a new tab
          </Button>
          <AnimatePresence initial={false}>
            {last ? (
              <motion.p
                key={last.name + last.size}
                role="status"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }}
                className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold">{last.name}</span> · {last.pages} page{last.pages === 1 ? "" : "s"} · {kb(last.size)}
                  {generatedAt ? ` · ${new Date(generatedAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}` : ""}
                  {last.branded ? "" : ". The brand fonts didn't load, so it used Helvetica."}
                </span>
              </motion.p>
            ) : null}
          </AnimatePresence>
          {error ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}
          <Button variant="ghost" size="sm" className="self-start" onClick={startOver}>
            <RotateCcw /> Start a new estimate
          </Button>
        </div>
      </Panel>
      <QuotePreview doc={doc} />
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} label={label} className="mt-0.5" />
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/* ── The preview: the PDF's first page, drawn in HTML from the same QuoteDoc ── */

/** The logo's ink, cropped from its 939 × 387 artboard exactly as the PDF crops it. */
const LOGO_BOX = (() => {
  const b = pathBounds([...LOCALE_HOMES_LOGO]);
  return `${b.x} ${b.y} ${b.w} ${b.h}`;
})();

const serif = { fontFamily: "var(--font-libre), Georgia, serif" } as const;

function QuotePreview({ doc }: { doc: QuoteDoc }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5 text-tone-ink" aria-hidden />
        Page one, as it prints
      </figcaption>
      <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-md bg-white text-[#323232] shadow-xl ring-1 shadow-black/15 ring-black/5 dark:shadow-black/50">
        <div className="relative flex h-[118px] items-center justify-between overflow-hidden bg-[#323232] px-[8%]">
          <svg viewBox={LOGO_BOX} className="h-[42px] w-auto" aria-label="Locale Homes" role="img">
            {LOCALE_HOMES_LOGO.map((d, i) => (
              <path key={i} d={d} fill="#F2F2F2" />
            ))}
          </svg>
          <div className="relative -mb-[60px] flex h-[164px] w-[104px] flex-col items-center pt-[46px] text-center">
            <svg viewBox={`0 0 ${HOMES_ARCH.width} ${HOMES_ARCH.height}`} className="absolute inset-x-0 top-0 h-full w-full" aria-hidden preserveAspectRatio="none">
              <path d={HOMES_ARCH.d} fill="none" stroke="#9CE3DB" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="text-[6px] font-semibold tracking-[0.2em] text-[#9CE3DB]">HOME ESTIMATE</span>
            <span className="mt-0.5 text-[15px] font-bold text-[#F2F2F2]" style={serif}>
              {doc.no}
            </span>
            <span className="text-[7px] text-[#C4C4C4]">{doc.date}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-[8%] pt-6 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-[#737373] italic" style={serif}>
                Prepared for
              </p>
              <p className="truncate text-[19px] leading-tight font-bold" style={serif}>
                {doc.client}
              </p>
              {doc.address ? <p className="truncate text-[9px] text-[#737373]">{doc.address}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[6px] font-semibold tracking-[0.18em] text-[#737373]">PREPARED BY</p>
              <p className="text-[9px]">{doc.preparedBy}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#9CE3DB] bg-[#F0FBF9] px-3.5 py-2.5">
            <div>
              <p className="text-[6.5px] font-semibold tracking-[0.18em] text-[#16746B]">FINAL BUILD PRICE</p>
              <p className="text-[8px] text-[#737373]">Base build, site costs and variations</p>
            </div>
            <p className="text-[21px] font-bold tabular-nums" style={serif}>
              {money(doc.final)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["The client", doc.clientRows],
                ["Your home", doc.homeRows],
              ] as const
            ).map(([title, rows]) => (
              <div key={title} className="min-w-0">
                <span className="block h-[2px] w-4 bg-[#9CE3DB]" aria-hidden />
                <p className="mt-1.5 mb-1 text-[6.5px] font-semibold tracking-[0.18em]">{title.toUpperCase()}</p>
                {rows.slice(0, 7).map(([k, v]) => (
                  <p key={k + v} className="flex gap-2 text-[8px] leading-[1.45]">
                    <span className="w-14 shrink-0 text-[#737373]">{k}</span>
                    <span className="min-w-0 truncate">{v}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div>
            <span className="block h-[2px] w-4 bg-[#9CE3DB]" aria-hidden />
            <p className="mt-1.5 mb-1 text-[6.5px] font-semibold tracking-[0.18em]">PRICE BREAKDOWN</p>
            {doc.price.map((r) => (
              <p key={r.label} className="flex justify-between border-b border-[#E4E4E4] py-[3px] text-[8.5px]">
                <span>{r.label}</span>
                <span className="font-semibold tabular-nums">
                  {r.sign === "+" ? "+" : r.sign === "−" ? "–" : ""}
                  {money(r.amount)}
                </span>
              </p>
            ))}
            <p className="mt-1.5 flex justify-between rounded bg-[#DDF6F2] px-2 py-1.5 text-[9px] font-semibold">
              <span>Final build price</span>
              <span className="tabular-nums" style={serif}>
                {money(doc.final)}
              </span>
            </p>
          </div>
          <div className="mt-1 border-t border-[#9CE3DB] pt-1.5">
            <p className="text-[5.5px] font-semibold tracking-[0.2em]">LOCALE HOMES</p>
            <p className="text-[6px] leading-snug text-[#737373]">{doc.disclaimer}</p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-subtle-foreground">
        {[doc.lines ? `${doc.lines.length} variation${doc.lines.length === 1 ? "" : "s"}` : "Variations not itemised", doc.siteLines ? "site cost breakdown" : null, doc.notes ? "your note" : null, "next steps"]
          .filter(Boolean)
          .join(" · ")}{" "}
        follow on the next page.
      </p>
    </figure>
  );
}
