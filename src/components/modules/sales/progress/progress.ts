/**
 * Sales progress rules, pure (no React). What My progress, the Sales portal's
 * Overview, Team's commission column and Jarvis quote. Every figure is for
 * one rep, from the live deals in the Sales store.
 */
import {
  PIPELINE_STAGES,
  SALES_WON_QTD,
  STAGE_REPORT_DEALS,
  STAGE_REPORT_LEADS,
  isOpenDeal,
  seedDeals,
  type PipelineDeal,
  type PipelineStage,
} from "../data";
import { COMMISSION_PER_SALE, STALE_DAYS, type ForecastWeek } from "./data";

const DAY = 86_400_000;

/** The board as seeded. Seed stages don't depend on the clock, so any `now` gives the same stages. */
const SEED_BOARD = seedDeals(0);

const wonBy = (deals: readonly PipelineDeal[], rep: string) =>
  deals.filter((d) => d.rep === rep && !d.lost && d.stage === "Sale won").length;

/** Deals the rep has moved to Sale won since the board was seeded, net of any moved back out. Never below zero. */
export function wonInSession(deals: readonly PipelineDeal[], seed: readonly PipelineDeal[], rep: string): number {
  return Math.max(0, wonBy(deals, rep) - wonBy(seed, rep));
}

/** Sales won month and quarter to date: HubSpot's figure for the rep (sample) plus this session's wins. */
export function wonToDate(rep: string, inSession: number): { month: number; quarter: number } {
  const month = STAGE_REPORT_DEALS.find(([r]) => r === rep)?.[1][3] ?? 0;
  const quarter = SALES_WON_QTD.find(([r]) => r === rep)?.[1] ?? 0;
  return { month: month + inSession, quarter: quarter + inSession };
}

/** `wonToDate` for the live board. */
export function wonSoFar(deals: readonly PipelineDeal[], rep: string): { month: number; quarter: number } {
  return wonToDate(rep, wonInSession(deals, SEED_BOARD, rep));
}

export interface TargetProgress {
  won: number;
  /** 0 when there's no target. */
  target: number;
  /** won ÷ target, capped at 1. Null with no target: draw no bar. */
  ratio: number | null;
  hit: boolean;
}

export function wonVsTarget(won: number, target: number): TargetProgress {
  if (!(target > 0)) return { won, target: 0, ratio: null, hit: false };
  return { won, target, ratio: Math.min(1, won / target), hit: won >= target };
}

/** Weeks in a row, counted back from the latest, that the rep signed within one of their forecast. */
export function forecastStreak(weeks: readonly ForecastWeek[]): number {
  let n = 0;
  for (let i = weeks.length - 1; i >= 0 && Math.abs(weeks[i].signed - weeks[i].forecast) <= 1; i--) n++;
  return n;
}

export interface FunnelStep {
  stage: PipelineStage;
  /** The rep's deals in this stage now. Lost deals excluded. */
  now: number;
  /** Deals that reached this stage: each deal reaches every stage up to its own, a lost one up to where it was lost. */
  reached: number;
  /** Share of the previous step's deals that reached this one. Null for the first step, and when nothing reached the previous one. */
  conversion: number | null;
}

export function funnel(deals: readonly PipelineDeal[], rep: string): FunnelStep[] {
  const mine = deals.filter((d) => d.rep === rep).map((d) => ({ rank: PIPELINE_STAGES.indexOf(d.stage), lost: Boolean(d.lost) }));
  const reachedAt = (i: number) => mine.filter((d) => d.rank >= i).length;
  return PIPELINE_STAGES.map((stage, i) => {
    const prev = i === 0 ? 0 : reachedAt(i - 1);
    return {
      stage,
      now: mine.filter((d) => d.rank === i && !d.lost).length,
      reached: reachedAt(i),
      conversion: prev === 0 ? null : reachedAt(i) / prev,
    };
  });
}

/** HubSpot's lead statuses, in order. */
export const LEAD_STATUSES = ["New", "Attempting", "Connected", "Qualified"] as const;

/** The rep's leads per status (sample, from HubSpot), or zeros. */
export function leadsFor(rep: string): number[] {
  return STAGE_REPORT_LEADS.find(([r]) => r === rep)?.[1] ?? [0, 0, 0, 0];
}

export interface StaleDeal {
  deal: PipelineDeal;
  /** Whole days in its stage. */
  days: number;
}

/** The rep's open deals that have sat in their stage STALE_DAYS or more, longest first. Exactly STALE_DAYS counts. */
export function staleDeals(deals: readonly PipelineDeal[], rep: string, now: number): StaleDeal[] {
  return deals
    .filter((d) => d.rep === rep && isOpenDeal(d) && now - d.stageSince >= STALE_DAYS * DAY)
    .map((deal) => ({ deal, days: Math.floor((now - deal.stageSince) / DAY) }))
    .sort((a, b) => b.days - a.days);
}

/** Commission on the rep's open deals: one sale's commission each, at the placeholder rate. */
export function commissionPipeline(deals: readonly PipelineDeal[], rep: string, perSale = COMMISSION_PER_SALE): number {
  return deals.filter((d) => d.rep === rep && isOpenDeal(d)).length * perSale;
}

/** Commission on sales won, at the placeholder rate. */
export function commissionEarned(won: number, perSale = COMMISSION_PER_SALE): number {
  return Math.max(0, won) * perSale;
}

/** 0.6667 → "67%". */
export const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
