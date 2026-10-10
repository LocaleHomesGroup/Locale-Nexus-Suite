import type { Db } from "../../db/types";
import { RunDeadlineError } from "../limits";
import type { PassResult } from "../monday/passes";
import { beginRun, endRun, getWatermark, LeaseLostError, renewRun, setWatermark, type Trigger } from "../runs";
import { HubSpotError, type HubSpotClient } from "./client";
import { MODIFIED, OBJECTS, PROPERTIES, type HubSpotObject } from "./properties";

/**
 * HubSpot into mirror.hubspot_*: the portal check, owners, deal pipelines,
 * then each object changed since its watermark (less 5 minutes), oldest first,
 * restarting from the newest seen before the search API's 10,000-result cap.
 *
 * Each page is a checkpoint: once it is stored (a page of deals with its
 * contacts), the object's watermark moves to the newest modified time on it,
 * and never back. So a run cut short by its time limit, or one object's
 * failure, loses at most the page in hand, and the next run continues from the
 * last stored page. An object that can't advance (9,800 or more objects on one
 * modified time) or reaches the page guard ends the pass partial; one that
 * fails ends it failed; either way the other objects still run. A 401, the
 * daily limit and the time limit stop the whole pass: a 401 as failed, the
 * other two as partial, since the next run carries on. The pass renews its
 * lease before each object, and stops partial if another pass took it over.
 */
interface SearchResult {
  id: string;
  properties?: Record<string, string | null>;
  createdAt?: string | null;
  updatedAt?: string | null;
  archived?: boolean;
}

interface SearchPage {
  results?: SearchResult[];
  paging?: { next?: { after?: string } };
}

interface OwnersPage {
  results?: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    userId?: number | null;
    teams?: unknown[] | null;
    archived?: boolean;
    updatedAt?: string | null;
  }[];
  paging?: { next?: { after?: string } };
}

interface AssociationsBatch {
  results?: { from: { id: string }; to?: { toObjectId: number }[] }[];
  errors?: unknown[];
}

const OVERLAP_MS = 5 * 60_000;
/** The pass's lease, renewed to this long again before each object. */
const LOCK_SECONDS = 900;
/** Pages one object's search may take in a run. */
const MAX_PAGES = 1000;
/** The search API stops at 10,000 results: before that, start again from the newest seen. */
const RESTART_AT = 9800;
const TIME_LIMIT_NOTE = "stopped at the run's time limit; the next run picks up from here";

/** "deals" gives "deals' last stored page". Every object's name is a plural. */
const timeLimitNote = (type: HubSpotObject) => `stopped at the run's time limit; the next run continues from ${type}' last stored page`;

async function upsertObjects(db: Db, type: HubSpotObject, results: SearchResult[]): Promise<number> {
  if (results.length === 0) return 0;
  const rows = [...new Map(results.map((r) => [r.id, r])).values()].map((r) => ({
    id: Number(r.id),
    properties: r.properties ?? {},
    archived: r.archived ?? false,
    created_at: r.createdAt ?? null,
    updated_at: r.updatedAt ?? null,
  }));
  const out = await db.query<{ id: number }>(
    `insert into mirror.hubspot_objects as o (object_type, id, properties, archived, hs_created_at, hs_updated_at)
     select $1, x.id, x.properties, x.archived, x.created_at, x.updated_at
     from jsonb_to_recordset($2::jsonb) as x(id bigint, properties jsonb, archived boolean, created_at timestamptz, updated_at timestamptz)
     on conflict (object_type, id) do update set
       properties = excluded.properties, archived = excluded.archived,
       hs_created_at = excluded.hs_created_at, hs_updated_at = excluded.hs_updated_at, synced_at = now()
     -- The properties too, not only the modified time: one added to PROPERTIES later reaches a stored row the next
     -- time HubSpot returns it, though the object itself hasn't changed.
     where (o.hs_updated_at, o.properties) is distinct from (excluded.hs_updated_at, excluded.properties)
     returning o.id`,
    [type, JSON.stringify(rows)],
  );
  return out.length;
}

/**
 * The modified time the search filters and sorts on, in milliseconds: the property, or `updatedAt` when the property
 * is missing or can't be read. Null when neither can.
 */
function modifiedAt(r: SearchResult, prop: string): number | null {
  for (const value of [r.properties?.[prop], r.updatedAt]) {
    const t = Date.parse(value ?? "");
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

type SearchEnd = { end: "done" } | { end: "stalled"; at: number } | { end: "page-limit" };

/**
 * Pages through everything changed since `sinceMs`, oldest first. `onPage` gets each page with its newest modified
 * time. Before the 10,000-result cap it starts again from the newest seen, unless that is no later than where this
 * window started: then 9,800 or more objects share one time, and the search can't page past them.
 */
async function searchChanged(
  hubspot: HubSpotClient,
  type: HubSpotObject,
  sinceMs: number,
  onPage: (results: SearchResult[], newest: number | null) => Promise<void>,
): Promise<SearchEnd> {
  const prop = MODIFIED[type];
  let from = sinceMs;
  let after: string | undefined;
  let latest: number | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await hubspot.post<SearchPage>(`/crm/v3/objects/${type}/search`, {
      filterGroups: [{ filters: [{ propertyName: prop, operator: "GTE", value: String(from) }] }],
      sorts: [{ propertyName: prop, direction: "ASCENDING" }],
      properties: PROPERTIES[type],
      limit: 200,
      ...(after ? { after } : {}),
    });
    const results = res.results ?? [];
    let newest: number | null = null;
    for (const r of results) {
      const t = modifiedAt(r, prop);
      if (t !== null && (newest === null || t > newest)) newest = t;
    }
    await onPage(results, newest);
    if (newest !== null && (latest === null || newest > latest)) latest = newest;
    after = res.paging?.next?.after;
    if (!after) return { end: "done" };
    if (Number(after) >= RESTART_AT) {
      if (latest === null || latest <= from) return { end: "stalled", at: latest ?? from };
      from = latest;
      after = undefined;
    }
  }
  return { end: "page-limit" };
}

/**
 * Reads one page of deals' contacts. A deal the answer's results list leaves out has no contacts left, unless the
 * answer has no results list, or reports errors: then the deals it leaves out keep what they had, since nothing says
 * they lost them.
 */
async function readDealContacts(db: Db, hubspot: HubSpotClient, dealIds: string[]): Promise<void> {
  if (dealIds.length === 0) return;
  const assoc = await hubspot.post<AssociationsBatch>("/crm/v4/associations/deals/contacts/batch/read", {
    inputs: dealIds.map((id) => ({ id })),
  });
  const results = Array.isArray(assoc.results) ? assoc.results : null;
  const contacts = new Map<number, number[]>();
  for (const r of results ?? []) contacts.set(Number(r.from.id), (r.to ?? []).map((t) => t.toObjectId));
  if (results && (assoc.errors ?? []).length === 0) {
    for (const id of dealIds) if (!contacts.has(Number(id))) contacts.set(Number(id), []);
  }
  if (contacts.size === 0) return;
  await db.query(
    `update mirror.hubspot_objects o
        set associations = o.associations || jsonb_build_object('contacts', x.contacts)
       from jsonb_to_recordset($1::jsonb) as x(id bigint, contacts jsonb)
      where o.object_type = 'deals' and o.id = x.id`,
    [JSON.stringify([...contacts].map(([id, to]) => ({ id, contacts: to })))],
  );
}

/** A 401, the daily limit and the run's time limit stop the whole pass; anything else stops only its object. */
const stopsThePass = (e: unknown) =>
  e instanceof RunDeadlineError || (e instanceof HubSpotError && (e.status === 401 || e.policy === "DAILY"));

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runHubSpotPass(
  db: Db,
  hubspot: HubSpotClient,
  portalId: string,
  opts: { trigger: Trigger; now?: () => Date },
): Promise<PassResult> {
  const run = await beginRun(db, "hubspot", "changes", opts.trigger, LOCK_SECONDS);
  if (!run) return { status: "skipped", calls: 0, seen: 0, changed: 0, note: "another HubSpot pass is running", error: null };

  const callsBefore = hubspot.stats.calls;
  let seen = 0;
  let changed = 0;
  const notes: string[] = [];
  const errors: string[] = [];
  let current: HubSpotObject | null = null;

  /** One object, page by page. Returns a note when it stopped before the end. */
  async function syncObject(type: HubSpotObject): Promise<string | null> {
    const scope = `object:${type}`;
    const watermark = await getWatermark(db, "hubspot", scope);
    let stored = watermark ? watermark.getTime() : null;
    const since = stored !== null ? stored - OVERLAP_MS : 0;
    const search = await searchChanged(hubspot, type, since, async (results, newest) => {
      seen += results.length;
      changed += await upsertObjects(db, type, results);
      // A page of deals isn't stored until its contacts are, so a run cut here reads the page again, contacts and all.
      if (type === "deals") await readDealContacts(db, hubspot, results.map((r) => r.id));
      // The checkpoint never moves back: a resumed search starts OVERLAP_MS behind it, so its first page can end before it.
      if (newest !== null && (stored === null || newest > stored)) {
        await setWatermark(db, "hubspot", scope, new Date(newest));
        stored = newest;
      }
    });
    if (search.end === "stalled") {
      return `${type}: 9,800 or more objects share one modified time (${new Date(search.at).toISOString()}); Launchpad can't page past them yet`;
    }
    if (search.end === "page-limit") return `${type}: stopped after 1,000 pages; the next run continues`;
    return null;
  }

  try {
    const info = await hubspot.get<{ portalId: number }>("/account-info/v3/details");
    if (String(info.portalId) !== portalId) {
      throw new Error(`HUBSPOT_TOKEN reaches portal ${info.portalId}, not HUBSPOT_PORTAL_ID ${portalId}. Nothing was read.`);
    }

    for (const archived of [false, true]) {
      let after: string | undefined;
      do {
        const page: OwnersPage = await hubspot.get<OwnersPage>("/crm/v3/owners", {
          limit: "500",
          archived: String(archived),
          ...(after ? { after } : {}),
        });
        const rows = (page.results ?? []).map((o) => ({
          id: Number(o.id),
          user_id: o.userId ?? null,
          email: o.email ?? null,
          first_name: o.firstName ?? null,
          last_name: o.lastName ?? null,
          teams: o.teams ?? [],
          archived: o.archived ?? archived,
          updated_at: o.updatedAt ?? null,
        }));
        if (rows.length > 0) {
          await db.query(
            `insert into mirror.hubspot_owners as o (id, user_id, email, first_name, last_name, teams, archived, hs_updated_at)
             select x.id, x.user_id, x.email, x.first_name, x.last_name, coalesce(x.teams, '[]'::jsonb), x.archived, x.updated_at
             from jsonb_to_recordset($1::jsonb) as x(
               id bigint, user_id bigint, email text, first_name text, last_name text, teams jsonb, archived boolean, updated_at timestamptz)
             on conflict (id) do update set
               user_id = excluded.user_id, email = excluded.email, first_name = excluded.first_name,
               last_name = excluded.last_name, teams = excluded.teams, archived = excluded.archived,
               hs_updated_at = excluded.hs_updated_at, synced_at = now()`,
            [JSON.stringify(rows)],
          );
        }
        after = page.paging?.next?.after;
      } while (after);
    }

    const pipelines = await hubspot.get<{
      results?: { id: string; label: string; displayOrder?: number; archived?: boolean; stages?: unknown[] }[];
    }>("/crm/v3/pipelines/deals");
    const pipelineRows = (pipelines.results ?? []).map((p) => ({
      id: p.id, label: p.label, display_order: p.displayOrder ?? null, archived: p.archived ?? false, stages: p.stages ?? [],
    }));
    if (pipelineRows.length > 0) {
      await db.query(
        `insert into mirror.hubspot_pipelines as p (object_type, id, label, display_order, archived, stages)
         select 'deals', x.id, x.label, x.display_order, x.archived, x.stages
         from jsonb_to_recordset($1::jsonb) as x(id text, label text, display_order integer, archived boolean, stages jsonb)
         on conflict (object_type, id) do update set
           label = excluded.label, display_order = excluded.display_order, archived = excluded.archived,
           stages = excluded.stages, synced_at = now()`,
        [JSON.stringify(pipelineRows)],
      );
    }

    for (const type of OBJECTS) {
      // Between objects: renew the lease, so a long first load keeps it. If another pass took it over, stop here and write
      // nothing more.
      if (!(await renewRun(db, run, LOCK_SECONDS))) throw new LeaseLostError();
      current = type;
      try {
        const stoppedEarly = await syncObject(type);
        if (stoppedEarly) notes.push(stoppedEarly);
      } catch (e) {
        if (stopsThePass(e)) throw e;
        // This object stops at its last stored page; the others still run.
        errors.push(`${type}: ${messageOf(e)}`);
      }
    }
    current = null;
  } catch (e) {
    const where = current ? `${current}: ` : "";
    if (e instanceof LeaseLostError) notes.push(e.message);
    else if (e instanceof RunDeadlineError) notes.push(current ? timeLimitNote(current) : TIME_LIMIT_NOTE);
    // A spent daily quota is a stop, as Monday's is, not a fault: the next run after the reset carries on.
    else if (e instanceof HubSpotError && e.policy === "DAILY") notes.push(`${where}${e.message}`);
    else errors.push(`${where}${messageOf(e)}`);
  }

  const status: PassResult["status"] = errors.length > 0 ? "failed" : notes.length > 0 ? "partial" : "ok";
  const note = notes.length > 0 ? notes.join("; ") : null;
  let error = errors.length > 0 ? errors.join("; ") : null;
  try {
    await endRun(db, run, {
      status,
      calls: hubspot.stats.calls - callsBefore,
      complexity: 0,
      seen,
      changed,
      note,
      error,
      watermarkBefore: null,
      watermarkAfter: null,
    });
  } catch (e) {
    // endRun frees the lease whatever happens, as the Monday pass relies on. The result still tells the caller what the
    // pass did, with the bookkeeping's failure after any error of its own.
    const unrecorded = `the run couldn't be recorded: ${messageOf(e)}`;
    error = error ? `${error}; ${unrecorded}` : unrecorded;
  }
  return { status, calls: hubspot.stats.calls - callsBefore, seen, changed, note, error };
}
