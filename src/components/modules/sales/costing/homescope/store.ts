"use client";

import * as React from "react";
import { HUBSPOT_CONTACTS, STEPS, builderByName, stepIndex, type HubspotContact } from "./catalogue";
import { price } from "./pricing";

/**
 * The HomeScope estimate in progress, the step it is on, and the quotes saved
 * this session. Module scope, like the Pay run, so leaving for Calculator (or
 * another Sales section) and coming back finds the estimate where you left it.
 * Nothing is persisted and nothing is sent to Monday: a reload starts over.
 */

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Open for editing: the fields show and Save contact / Cancel sit in its header. */
  editing: boolean;
  /** What Cancel puts back. */
  backup?: Omit<Contact, "editing" | "backup">;
}

/** A custom site cost variation (HomeScope's "+ New Variation" on step 7). */
export interface OtherItem {
  id: string;
  title: string;
  price: number;
}

/** A selected variation: from the catalogue, a custom line, or a model's bolt-on. */
export interface Line {
  id: string;
  source: "catalogue" | "custom" | "boltOn";
  area: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  /** Include charges the client; exclude credits them. */
  inclusion: "include" | "exclude";
  pricing: "fixed" | "provisional";
  unitCharge: number;
  unitCredit: number;
  /** qty × the unit rate for its inclusion. */
  amount: number;
}

export type SiteCostChoice = { kind: "option"; index: number } | { kind: "provisional"; amount: number };

export interface Estimate {
  staff: string | null;
  contacts: Contact[];
  address: string;
  lotSize: number | null;
  corner: boolean;
  /** "Search by exact frontage": one frontage instead of a range. */
  exact: boolean;
  min: number | null;
  max: number | null;
  builder: string | null;
  model: string | null;
  range: string | null;
  elevation: string | null;
  siteCost: SiteCostChoice;
  /** Area-banded builders (LaVida, New Choice) price BAL, coastal and noise by floor area. */
  floorArea: number | null;
  title: { today: string; eta: string | null };
  bal: string | null;
  coastal: string | null;
  noise: string | null;
  others: OtherItem[];
  colourMode: "prestart" | "choose";
  colour: string | null;
  /** The rep's edited base build price. Cleared when the design changes. */
  baseOverride: number | null;
  lines: Line[];
}

export interface SavedQuote {
  no: string;
  savedAt: string;
  by: string;
  estimate: Estimate;
}

export interface PdfOptions {
  itemised: boolean;
  siteBreakdown: boolean;
  notes: string;
  validDays: number;
}

interface State {
  estimate: Estimate;
  /** The step showing, an index into STEPS. */
  step: number;
  /** The furthest step reached: the rail opens everything up to it. */
  reached: number;
  /** The saved quote this estimate came from or was saved as. */
  quoteNo: string | null;
  /** True once the estimate changes after its last save. */
  dirty: boolean;
  saved: SavedQuote[];
  pdf: PdfOptions;
  /** When the PDF was last generated, for the step 12 receipt. */
  generatedAt: string | null;
}

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const blankContact = (): Contact => ({ id: uid("c"), firstName: "", lastName: "", email: "", phone: "", editing: true });

export function blankEstimate(staff: string | null = null): Estimate {
  return {
    staff,
    contacts: [blankContact()],
    address: "",
    lotSize: null,
    corner: false,
    exact: false,
    min: null,
    max: null,
    builder: null,
    model: null,
    range: null,
    elevation: null,
    siteCost: { kind: "option", index: 0 },
    floorArea: null,
    title: { today: todayIso(), eta: null },
    bal: null,
    coastal: null,
    noise: null,
    others: [],
    colourMode: "prestart",
    colour: null,
    baseOverride: null,
    lines: [],
  };
}

const contactFrom = (c: HubspotContact): Contact => ({ id: uid("c"), ...c, editing: false });

/**
 * Two quotes "saved earlier", so Load Existing Quote has something to find.
 * Sample clients from the Pipeline, priced from the snapshot.
 */
function seedQuotes(): SavedQuote[] {
  const today = todayIso();
  const perera: Estimate = {
    ...blankEstimate("Adam Orlando"),
    contacts: [contactFrom(HUBSPOT_CONTACTS[2])],
    address: "Lot 412 Marmion Avenue, Alkimos WA 6038",
    lotSize: 450,
    max: 15,
    builder: "Forma",
    model: "Oakmont",
    range: "The Difference",
    elevation: "15m Verandah",
    siteCost: { kind: "option", index: 1 },
    title: { today, eta: null },
    bal: "12.5",
    coastal: "300-2000m",
    noise: "No noise applicable",
    lines: [
      {
        id: uid("l"),
        source: "catalogue",
        area: "Electrical",
        code: "V_ELEC_004",
        description: "Provide Internal 10A DGPO",
        unit: "EACH",
        qty: 4,
        inclusion: "include",
        pricing: "fixed",
        unitCharge: 76,
        unitCredit: 46,
        amount: 304,
      },
    ],
  };
  const tran: Estimate = {
    ...blankEstimate("Quentin Smith"),
    contacts: [contactFrom(HUBSPOT_CONTACTS[6])],
    address: "Lot 88 Lakelands Drive, Lakelands WA 6180",
    lotSize: 300,
    exact: true,
    min: 10,
    max: 10,
    builder: "New Choice",
    model: "Candelo",
    range: "Freedom",
    elevation: "Standard",
    siteCost: { kind: "option", index: 0 },
    floorArea: 160,
    bal: "BAL 12.5",
    coastal: "Greater than 1km",
    noise: "No noise applicable",
    colourMode: "choose",
    colour: "Scheme 2",
  };
  return [
    { no: "HS-1042", savedAt: "2026-10-03T14:12:00", by: "Quentin Smith", estimate: tran },
    { no: "HS-1041", savedAt: "2026-10-01T10:40:00", by: "Adam Orlando", estimate: perera },
  ];
}

const DEFAULT_PDF: PdfOptions = { itemised: true, siteBreakdown: true, notes: "", validDays: 30 };

function seed(): State {
  return {
    estimate: blankEstimate(),
    step: 0,
    reached: 0,
    quoteNo: null,
    dirty: false,
    saved: seedQuotes(),
    pdf: DEFAULT_PDF,
    generatedAt: null,
  };
}

let state: State | null = null;
const listeners = new Set<() => void>();
const current = () => (state ??= seed());

function setState(next: (s: State) => State) {
  state = next(current());
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The pane is client-only (loaded with `ssr: false`), so the server snapshot is never painted. */
export function useHomeScope(): State {
  return React.useSyncExternalStore(subscribe, current, current);
}

/** The estimate with its figures worked out. */
export function useEstimate() {
  const s = useHomeScope();
  const pricing = React.useMemo(() => price(s.estimate), [s.estimate]);
  return { ...s, pricing };
}

/* ── Editing the estimate ──────────────────────────────────────────────── */

function edit(fn: (e: Estimate) => Estimate) {
  setState((s) => ({ ...s, estimate: fn(s.estimate), dirty: s.quoteNo != null }));
}

export const patch = (p: Partial<Estimate>) => edit((e) => ({ ...e, ...p }));

export function patchContact(id: string, p: Partial<Contact>) {
  edit((e) => ({ ...e, contacts: e.contacts.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
}

export const contactValid = (c: Pick<Contact, "firstName" | "lastName" | "email">) =>
  c.firstName.trim().length > 0 && c.lastName.trim().length > 0 && /\S+@\S+\.\S+/.test(c.email.trim());

export function editContact(id: string) {
  edit((e) => ({
    ...e,
    contacts: e.contacts.map((c) =>
      c.id === id
        ? { ...c, editing: true, backup: { id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone } }
        : c,
    ),
  }));
}

export function saveContact(id: string) {
  edit((e) => ({
    ...e,
    contacts: e.contacts.map((c) => (c.id === id && contactValid(c) ? { ...c, editing: false, backup: undefined } : c)),
  }));
}

/** Cancel: a new, empty contact goes away (or empties, if it's the only one); an edit goes back. */
export function cancelContact(id: string) {
  edit((e) => {
    const c = e.contacts.find((x) => x.id === id);
    if (!c) return e;
    if (c.backup) return { ...e, contacts: e.contacts.map((x) => (x.id === id ? { ...c.backup!, editing: false } : x)) };
    if (e.contacts.length > 1) return { ...e, contacts: e.contacts.filter((x) => x.id !== id) };
    return { ...e, contacts: [blankContact()] };
  });
}

export const addContact = () => edit((e) => ({ ...e, contacts: [...e.contacts, blankContact()] }));

export function removeContact(id: string) {
  edit((e) => {
    const rest = e.contacts.filter((c) => c.id !== id);
    return { ...e, contacts: rest.length ? rest : [blankContact()] };
  });
}

/** A HubSpot result fills the empty contact being entered, or joins the list. */
export function pickHubspot(h: HubspotContact) {
  edit((e) => {
    const empty = e.contacts.find((c) => c.editing && !c.firstName && !c.lastName && !c.email);
    const filled = contactFrom(h);
    return {
      ...e,
      contacts: empty ? e.contacts.map((c) => (c.id === empty.id ? { ...filled, id: c.id } : c)) : [...e.contacts, filled],
    };
  });
}

/** Everything after the builder: HomeScope's clearDownstreamOfBuilder. */
const AFTER_BUILDER: Partial<Estimate> = {
  model: null,
  range: null,
  elevation: null,
  siteCost: { kind: "option", index: 0 },
  floorArea: null,
  bal: null,
  coastal: null,
  noise: null,
  others: [],
  colourMode: "prestart",
  colour: null,
  baseOverride: null,
  lines: [],
};

/** Picking another builder clears every later step and closes the rail after Model. */
export function chooseBuilder(name: string) {
  const s = current();
  if (s.estimate.builder === name) return;
  setState((st) => ({
    ...st,
    dirty: st.quoteNo != null,
    estimate: { ...st.estimate, ...AFTER_BUILDER, builder: name, title: { today: st.estimate.title.today, eta: null } },
    reached: Math.min(st.reached, stepIndex("model")),
  }));
}

/** Another model drops the old model's bolt-ons; its edited base no longer applies. */
export function chooseModel(name: string) {
  edit((e) =>
    e.model === name
      ? e
      : { ...e, model: name, baseOverride: null, lines: e.lines.filter((l) => l.source !== "boltOn") },
  );
}

export const chooseRange = (name: string) => edit((e) => (e.range === name ? e : { ...e, range: name, baseOverride: null }));
export const chooseElevation = (name: string) =>
  edit((e) => (e.elevation === name ? e : { ...e, elevation: name, baseOverride: null }));

export function chooseColour(mode: Estimate["colourMode"], colour: string | null = null) {
  edit((e) => ({ ...e, colourMode: mode, colour: mode === "prestart" ? null : colour, baseOverride: null }));
}

/** A new floor area band keeps each rate only if the band has one by that name (HomeScope's revalidate). */
export function chooseFloorArea(area: number) {
  edit((e) => {
    const b = builderByName(e.builder);
    if (!b) return e;
    const keep = (list: "bal" | "coastal" | "noise", name: string | null) =>
      name && b[list].some((r) => r.area === area && r.name === name) ? name : null;
    return { ...e, floorArea: area, bal: keep("bal", e.bal), coastal: keep("coastal", e.coastal), noise: keep("noise", e.noise) };
  });
}

export const addOther = (title: string, amount: number) =>
  edit((e) => ({ ...e, others: [...e.others, { id: uid("o"), title: title.trim() || "Other", price: amount }] }));
export const updateOther = (id: string, p: Partial<OtherItem>) =>
  edit((e) => ({ ...e, others: e.others.map((o) => (o.id === id ? { ...o, ...p } : o)) }));
export const removeOther = (id: string) => edit((e) => ({ ...e, others: e.others.filter((o) => o.id !== id) }));

/** qty × the unit rate for the line's inclusion. */
export const lineAmount = (l: Pick<Line, "qty" | "inclusion" | "unitCharge" | "unitCredit">) =>
  Math.round(l.qty * (l.inclusion === "include" ? l.unitCharge : l.unitCredit) * 100) / 100;

export function addLine(line: Omit<Line, "id" | "amount">) {
  edit((e) => ({ ...e, lines: [...e.lines, { ...line, id: uid("l"), amount: lineAmount(line) }] }));
}

export function updateLine(id: string, p: Partial<Omit<Line, "id" | "amount">>) {
  edit((e) => ({
    ...e,
    lines: e.lines.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, ...p };
      return { ...next, amount: lineAmount(next) };
    }),
  }));
}

export const removeLine = (id: string) => edit((e) => ({ ...e, lines: e.lines.filter((l) => l.id !== id) }));

/* ── Moving through the steps ──────────────────────────────────────────── */

export function goToStep(step: number) {
  setState((s) => {
    const to = Math.max(0, Math.min(STEPS.length - 1, step));
    if (to > s.reached) return s;
    return { ...s, step: to };
  });
}

export function nextStep() {
  setState((s) => {
    const to = Math.min(STEPS.length - 1, s.step + 1);
    return { ...s, step: to, reached: Math.max(s.reached, to) };
  });
}

export const prevStep = () => setState((s) => ({ ...s, step: Math.max(0, s.step - 1) }));

/** Start a blank estimate, keeping the staff member picked last time (HomeScope remembers it). */
export function startOver() {
  setState((s) => ({
    ...s,
    estimate: blankEstimate(s.estimate.staff),
    step: 0,
    reached: 0,
    quoteNo: null,
    dirty: false,
    pdf: DEFAULT_PDF,
    generatedAt: null,
  }));
}

/* ── Quotes ────────────────────────────────────────────────────────────── */

const nextNo = (saved: SavedQuote[]) =>
  `HS-${Math.max(1040, ...saved.map((q) => Number(q.no.replace(/\D/g, "")) || 0)) + 1}`;

/**
 * HomeScope's Submit, kept in Launchpad: the quote is saved under a number
 * (re-saving a loaded quote keeps its number) and the flow moves on to the PDF.
 * The Dash Sync is held, so nothing goes to Monday.
 */
export function saveQuote(): SavedQuote {
  const s = current();
  const no = s.quoteNo ?? nextNo(s.saved);
  const quote: SavedQuote = {
    no,
    savedAt: new Date().toISOString(),
    by: s.estimate.staff ?? "Unassigned",
    estimate: structuredClone(s.estimate),
  };
  setState((st) => ({
    ...st,
    quoteNo: no,
    dirty: false,
    saved: [quote, ...st.saved.filter((q) => q.no !== no)],
    step: stepIndex("pdf"),
    reached: STEPS.length - 1,
  }));
  return quote;
}

/** HomeScope's Load Existing Quote: everything restored, every step open, straight to the Summary. */
export function loadQuote(no: string) {
  const q = current().saved.find((x) => x.no === no);
  if (!q) return;
  setState((s) => ({
    ...s,
    estimate: { ...structuredClone(q.estimate), title: { ...q.estimate.title, today: todayIso() } },
    quoteNo: q.no,
    dirty: false,
    step: stepIndex("summary"),
    reached: STEPS.length - 1,
    generatedAt: null,
  }));
}

export const setPdf = (p: Partial<PdfOptions>) => setState((s) => ({ ...s, pdf: { ...s.pdf, ...p } }));
export const markGenerated = () => setState((s) => ({ ...s, generatedAt: new Date().toISOString() }));

/** The client's name as the quote heads it: "Femi and Ruth Osei", "Nadeesha Perera". */
export function clientName(e: Estimate): string {
  const people = e.contacts.filter((c) => c.firstName || c.lastName);
  if (!people.length) return "New client";
  const surnames = [...new Set(people.map((c) => c.lastName.trim()))];
  if (surnames.length === 1 && people.length > 1)
    return `${people.map((c) => c.firstName.trim()).join(" and ")} ${surnames[0]}`;
  return people.map((c) => `${c.firstName} ${c.lastName}`.trim()).join(" and ");
}

export const isPreStart = (e: Estimate) => e.colourMode === "prestart";
export const colourLabel = (e: Estimate) => (isPreStart(e) ? "Chosen at pre-start" : (e.colour ?? "Not chosen"));
