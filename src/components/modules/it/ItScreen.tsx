"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Send } from "lucide-react";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { useTabParam } from "@/hooks/useTabParam";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Field, Label, Textarea } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import {
  PRIORITIES,
  REQUESTER,
  TICKET_CATEGORIES,
  TICKET_SEED,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "./data";
import { ItOverview } from "./ItOverview";

/** Open = waiting on IT (amber), in progress = neutral info, resolved = done (emerald). */
const STATUS_TONE: Record<TicketStatus, PillTone> = {
  Open: "pending",
  "In progress": "tone",
  Resolved: "ok",
};

const CATEGORY_OPTIONS = TICKET_CATEGORIES.map((c) => ({ value: c, label: c }));

const TABS = ["overview", "helpdesk"] as const;

/**
 * IT — an Overview (the default) and the Help desk, in the rail (`?tab=`).
 * Tickets live here, above both, so one raised on the Help desk is counted on
 * the Overview.
 */
export function ItScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const [tickets, setTickets] = React.useState<Ticket[]>(TICKET_SEED);
  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "overview" ? <ItOverview tickets={tickets} /> : <HelpDesk tickets={tickets} setTickets={setTickets} />}
      </TabPanels>
    </PageContainer>
  );
}

/** The mockup's `zm` help desk: raise a ticket, see the open and recent ones. */
function HelpDesk({
  tickets,
  setTickets,
}: {
  tickets: Ticket[];
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
}) {
  const { notify } = useLaunchpad();
  const reduce = useReducedMotion();
  const [category, setCategory] = React.useState<TicketCategory>("Access and permissions");
  const [priority, setPriority] = React.useState<TicketPriority>("Medium");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState(false);
  const [freshId, setFreshId] = React.useState<number | null>(null);

  // The new row wears a Haven wash for a moment, then settles like the rest.
  React.useEffect(() => {
    if (freshId == null) return;
    const t = setTimeout(() => setFreshId(null), 2600);
    return () => clearTimeout(t);
  }, [freshId]);

  const open = tickets.filter((t) => t.status !== "Resolved").length;
  const descId = React.useId();
  const categoryId = React.useId();
  const priorityId = React.useId();
  const descRef = React.useRef<HTMLTextAreaElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = description.trim();
    if (!text) {
      setError(true);
      descRef.current?.focus();
      return;
    }
    const firstLine = text.split("\n")[0].trim();
    const summary = firstLine.length > 56 ? `${firstLine.slice(0, 55).trimEnd()}…` : firstLine;
    const id = Math.max(0, ...tickets.map((t) => t.id)) + 1;
    setTickets((prev) => [
      { id, title: `${category} — ${summary}`, requester: REQUESTER, priority, status: "Open" },
      ...prev,
    ]);
    setFreshId(id);
    setDescription("");
    setPriority("Medium");
    setError(false);
    confirm(`Ticket #${id} submitted`, `${priority} priority · ${category}`);
    notify(`IT ticket #${id} submitted — ${summary}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="IT help desk"
        description="Raise it here — not in a hallway conversation — so nothing gets lost."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal index={0} className="min-w-0">
          <Card tone="accent">
            <CardHeader>
              <CardTitle>New ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
                <Field label="Category" htmlFor={categoryId}>
                  <SmoothSelect
                    id={categoryId}
                    value={category}
                    onChange={setCategory}
                    options={CATEGORY_OPTIONS}
                  />
                </Field>

                <div className="space-y-1.5">
                  <Label id={priorityId}>Priority</Label>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={priorityId}>
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={priority === p}
                        onClick={() => setPriority(p)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                          priority === p
                            ? "border-tone-fill bg-tone-fill font-semibold text-tone-on-fill"
                            : "border-border bg-card text-foreground hover:border-tone-line hover:bg-tone-soft/70 dark:bg-white/[0.03] dark:hover:bg-tone-soft",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={descId}>What&apos;s happening?</Label>
                  <Textarea
                    ref={descRef}
                    id={descId}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (error && e.target.value.trim()) setError(false);
                    }}
                    placeholder="Describe the issue…"
                    rows={3}
                    aria-invalid={error || undefined}
                    aria-describedby={error ? `${descId}-error` : undefined}
                    className="min-h-[72px] text-[13px]"
                  />
                  {error ? (
                    <p id={`${descId}-error`} role="alert" className="text-xs text-rose-700 dark:text-rose-300">
                      Describe the issue before you submit.
                    </p>
                  ) : null}
                </div>

                <div>
                  <Button type="submit" size="lg">
                    <Send aria-hidden /> Submit ticket
                  </Button>
                </div>

                <p className="text-xs leading-relaxed text-subtle-foreground">
                  Urgent?{" "}
                  <a
                    href="mailto:support@localegroup.au"
                    className="font-medium text-tone-ink underline-offset-2 hover:underline"
                  >
                    support@localegroup.au
                  </a>{" "}
                  or message Jerry / Pablo on Teams.
                </p>
              </form>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={1} className="min-w-0">
          <Card>
            <CardHeader className="border-b border-hairline pb-3">
              <CardTitle>Open and recent tickets</CardTitle>
              <CardMeta>{open} open</CardMeta>
            </CardHeader>
            <CardContent className="px-0 pb-1">
              <ul>
                <AnimatePresence initial={false}>
                  {tickets.map((t, i) => (
                    <motion.li
                      key={t.id}
                      layout="position"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: { duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: t.id === freshId ? 0 : rowDelay(i, reduce) },
                      }}
                      className={cn(
                        "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-hairline px-5 py-3 transition-colors first:border-t-0",
                        t.id === freshId && "bg-tone-soft/70",
                      )}
                    >
                      <span className="w-9 shrink-0 font-mono text-xs text-subtle-foreground tabular-nums">
                        #{t.id}
                      </span>
                      <div className="min-w-[180px] flex-1">
                        <p className="text-[13px] font-semibold">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.requester} · {t.priority} priority
                        </p>
                      </div>
                      <Pill tone={STATUS_TONE[t.status]} variant="caps" className="ml-auto">
                        {t.status}
                      </Pill>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
