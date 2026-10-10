"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, MapPin, Pencil, Plus, Search, Trash2, TriangleAlert, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { HUBSPOT_CONTACTS, STAFF, modelsForBlock } from "../catalogue";
import { useCatalogue } from "../catalogue-context";
import {
  addContact,
  cancelContact,
  contactValid,
  editContact,
  patch,
  patchContact,
  pickHubspot,
  removeContact,
  saveContact,
  useEstimate,
  type Contact,
} from "../store";
import { MeasureInput, Panel, PanelTitle } from "../parts";

/**
 * Step 1, Client details: HomeScope's HubSpot search, staff picker and
 * contact list, then the block. The frontage bounds decide which designs the
 * next steps offer, so the step counts them as you type.
 */
export function ClientStep() {
  const { estimate: e } = useEstimate();
  const { builders } = useCatalogue();
  const block = { corner: e.corner, min: e.min, max: e.max };
  const bounded = e.corner || e.min != null || e.max != null;
  const matches = bounded
    ? builders.map((b) => ({ name: b.name, count: modelsForBlock(b, block).length })).filter((b) => b.count > 0)
    : [];
  const total = matches.reduce((n, b) => n + b.count, 0);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Panel>
        <PanelTitle icon={Users}>The client</PanelTitle>
        <div className="flex flex-col gap-3">
          <HubspotSearch />
          <Field label="Prepared by" htmlFor="hs-staff">
            <SmoothSelect
              id="hs-staff"
              value={e.staff ?? ""}
              onChange={(staff) => patch({ staff })}
              placeholder="Select staff name"
              leading={<UserRound className="size-3.5" aria-hidden />}
              options={STAFF.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {e.contacts.map((c, i) => (
                <ContactCard key={c.id} contact={c} index={i} only={e.contacts.length === 1} />
              ))}
            </AnimatePresence>
          </ul>
          {!e.contacts.some((c) => c.editing) ? (
            <Button variant="link" size="sm" className="self-start" onClick={addContact}>
              <Plus /> Add another contact
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelTitle icon={MapPin}>The block</PanelTitle>
        <div className="flex flex-col gap-3">
          <Field label="Site address *" htmlFor="hs-address">
            <Input
              id="hs-address"
              value={e.address}
              autoComplete="street-address"
              placeholder="e.g. Lot 412 Marmion Avenue, Alkimos WA 6038"
              onChange={(ev) => patch({ address: ev.target.value })}
            />
          </Field>
          <Field label="Total lot size *" htmlFor="hs-lot">
            <MeasureInput id="hs-lot" value={e.lotSize} onChange={(lotSize) => patch({ lotSize })} unit="m²" placeholder="e.g. 450" />
          </Field>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox checked={e.corner} onChange={(ev) => patch({ corner: ev.target.checked })} />
              Corner block?
            </label>
            {!e.corner ? (
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <Checkbox
                  checked={e.exact}
                  onChange={(ev) => patch(ev.target.checked ? { exact: true, min: e.max ?? e.min, max: e.max ?? e.min } : { exact: false })}
                />
                Search by exact frontage
              </label>
            ) : null}
          </div>
          {e.corner ? (
            <p className="text-xs text-muted-foreground">Corner blocks list the designs each builder marks for a corner.</p>
          ) : e.exact ? (
            <Field label="Design frontage *" htmlFor="hs-exact" hint="Returns only designs whose To Suit Block matches exactly.">
              <MeasureInput id="hs-exact" value={e.max} onChange={(v) => patch({ min: v, max: v })} unit="m" placeholder="e.g. 12.5" />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max design frontage" htmlFor="hs-max">
                <MeasureInput id="hs-max" value={e.max} onChange={(max) => patch({ max })} unit="m" placeholder="No maximum" />
              </Field>
              <Field label="Min design frontage" htmlFor="hs-min">
                <MeasureInput id="hs-min" value={e.min} onChange={(min) => patch({ min })} unit="m" placeholder="No minimum" />
              </Field>
              <p className="col-span-2 -mt-1 text-xs text-subtle-foreground">Fill at least one bound to filter the design list.</p>
            </div>
          )}
          <BlockMatches bounded={bounded} total={total} matches={matches} />
        </div>
      </Panel>
    </div>
  );
}

/** How many designs the block suits, per builder: the answer before you press Continue. */
function BlockMatches({ bounded, total, matches }: { bounded: boolean; total: number; matches: { name: string; count: number }[] }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      {!bounded ? null : total === 0 ? (
        <motion.p
          key="none"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
          role="status"
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          Sorry! No plan is available for the block size. Widen the frontage bounds.
        </motion.p>
      ) : (
        <motion.div
          key="some"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
          role="status"
          className="rounded-lg border border-tone-line bg-tone-soft/60 px-3 py-2"
        >
          <p className="text-xs font-semibold text-foreground tabular-nums">
            {total} design{total === 1 ? "" : "s"} across {matches.length} builder{matches.length === 1 ? "" : "s"} suit this block
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{matches.map((m) => `${m.name} ${m.count}`).join(" · ")}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** HomeScope's "Search HubSpot contacts by name, email or phone…": a pick fills the contact being entered. */
function HubspotSearch() {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const results =
    term.length < 2
      ? []
      : HUBSPOT_CONTACTS.filter(
          (c) =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term) ||
            (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)),
        );

  React.useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle-foreground" aria-hidden />
      <Input
        type="search"
        role="combobox"
        aria-expanded={open && term.length >= 2}
        aria-label="Search HubSpot contacts"
        placeholder="Search HubSpot contacts by name, email or phone…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(ev) => {
          setQ(ev.target.value);
          setOpen(true);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Escape") setOpen(false);
        }}
        className="pl-8"
      />
      <AnimatePresence>
        {open && term.length >= 2 ? (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.16, ease: EASE_OUT }}
            className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            {results.length ? (
              results.map((c) => (
                <li key={c.email} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      pickHubspot(c);
                      setQ("");
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-tone-soft focus-visible:bg-tone-soft focus-visible:outline-none"
                  >
                    <span className="text-[13px] font-medium">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.email} · {c.phone}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2.5 py-2 text-xs text-muted-foreground">No HubSpot contact matches. Enter the client below.</li>
            )}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** One contact: collapsed to "Name - email" once saved, open while it's being entered or edited. */
function ContactCard({ contact: c, index, only }: { contact: Contact; index: number; only: boolean }) {
  const reduce = useReducedMotion();
  // Editing always shows the fields; once saved it folds away unless opened to read.
  const [expanded, setExpanded] = React.useState(false);
  const open = c.editing || expanded;
  const valid = contactValid(c);
  const named = c.firstName || c.lastName;
  const id = (f: string) => `hs-${f}-${c.id}`;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: reduce ? 0 : 0.14 } }}
      transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
      className={cn("overflow-hidden rounded-lg border bg-card", c.editing ? "border-tone-line" : "border-border")}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
        <p className="min-w-0 flex-1 basis-40 truncate text-[13px] font-semibold">
          {named ? (
            <>
              {c.firstName} {c.lastName}
              {c.email ? <span className="font-normal text-muted-foreground"> · {c.email}</span> : null}
            </>
          ) : (
            <span className="text-muted-foreground">{only ? "Enter client details" : `Contact ${index + 1}`}</span>
          )}
        </p>
        {c.editing ? (
          <>
            <Button size="xs" variant={valid ? "brand" : "outline"} disabled={!valid} onClick={() => saveContact(c.id)}>
              <Check /> Save contact
            </Button>
            <Button size="xs" variant="ghost" onClick={() => cancelContact(c.id)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="icon-xs" variant="ghost" aria-label={`Edit ${c.firstName}`} onClick={() => editContact(c.id)}>
              <Pencil />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label={`Remove ${c.firstName}`} onClick={() => removeContact(c.id)}>
              <Trash2 />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={expanded ? "Collapse" : "Expand"}
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown className={cn("transition-transform duration-200", expanded && "rotate-180")} />
            </Button>
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
          >
            <div className="grid grid-cols-2 gap-3 border-t border-hairline px-3 pt-2.5 pb-3">
              <Field label="First name *" htmlFor={id("first")}>
                <Input id={id("first")} value={c.firstName} readOnly={!c.editing} autoComplete="given-name" onChange={(ev) => patchContact(c.id, { firstName: ev.target.value })} />
              </Field>
              <Field label="Last name *" htmlFor={id("last")}>
                <Input id={id("last")} value={c.lastName} readOnly={!c.editing} autoComplete="family-name" onChange={(ev) => patchContact(c.id, { lastName: ev.target.value })} />
              </Field>
              <Field label="Mobile" htmlFor={id("phone")}>
                <Input id={id("phone")} value={c.phone} readOnly={!c.editing} inputMode="tel" autoComplete="tel" onChange={(ev) => patchContact(c.id, { phone: ev.target.value })} />
              </Field>
              <Field label="Email *" htmlFor={id("email")}>
                <Input
                  id={id("email")}
                  type="email"
                  value={c.email}
                  readOnly={!c.editing}
                  autoComplete="email"
                  aria-invalid={c.editing && c.email.length > 3 && !/\S+@\S+\.\S+/.test(c.email) ? true : undefined}
                  onChange={(ev) => patchContact(c.id, { email: ev.target.value })}
                />
              </Field>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}
