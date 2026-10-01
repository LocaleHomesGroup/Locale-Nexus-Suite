"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Maximize2, Minimize2, Minus, Plus, Scan, UserPlus, UserRound } from "lucide-react";
import { animate, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP } from "@/lib/motion";
import { Card, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import {
  ORG_BRANDS,
  ORG_DEPARTMENTS,
  orgDepartment,
  orgDepartmentOf,
  type OrgBrand,
  type OrgDepartmentId,
  type OrgPerson,
} from "./data";
import { useOrg } from "./org-store";
import { AddPersonDialog, type AddTarget } from "./AddPersonDialog";

/**
 * HR › Dashboard › Organisation chart: the group's org chart drawn live, not
 * as an image. The managing director sits at the top with the board seat
 * beside them and their assistant off the stem; each department head fans out
 * below. A manager's like seats (New Home Advocates, Finance Brokers) draw as
 * one block, and a manager whose reports lead no one lists them down a rail,
 * as the paper chart does, so the chart stays as narrow as it can.
 *
 * The chart lives in its own panel (`ChartCanvas`): every view opens fitted
 * so the whole of it is in sight, then zooms in (double-click, Ctrl/Cmd +
 * scroll or pinch, the zoom buttons, the + and - keys) and drags or scrolls
 * about inside the panel without moving the page. Full screen gives it the
 * whole window. The department filter draws one department on its own.
 *
 * Adding someone: + under any seat, "Add to team" on a team block, "Fill seat"
 * on a vacant one, or Add person in the header. See `AddPersonDialog`.
 */
type OrgView = "all" | OrgDepartmentId;

const LINE = "bg-zinc-300 dark:bg-zinc-600";

const RIM: Record<OrgBrand, string> = {
  homes: "bg-haven-300",
  financial: "bg-nectar-300",
  wealth: "bg-skyblue-300",
};

const WASH: Record<OrgBrand | "group", { box: string; ink: string }> = {
  homes: {
    box: "border-haven-300 bg-haven-50 dark:border-haven-700/60 dark:bg-haven-500/10",
    ink: "text-haven-800 dark:text-haven-200",
  },
  financial: {
    box: "border-nectar-300 bg-nectar-50 dark:border-nectar-700/50 dark:bg-nectar-500/10",
    ink: "text-nectar-800 dark:text-nectar-200",
  },
  wealth: {
    box: "border-skyblue-300 bg-skyblue-50 dark:border-skyblue-700/50 dark:bg-skyblue-500/10",
    ink: "text-skyblue-800 dark:text-skyblue-200",
  },
  group: { box: "border-border bg-canvas", ink: "text-muted-foreground" },
};

const avatarTone = (brands?: OrgBrand[]) => (brands?.length ? ORG_BRANDS[brands[0]].tone : "charcoal");

const brandWords = (brands?: OrgBrand[]) =>
  brands?.length ? brands.map((b) => ORG_BRANDS[b].label).join(" and ") : "Group services";

interface ChartCtx {
  byId: Map<string, OrgPerson>;
  /** Seats drawn beneath a seat, in chart order. */
  reportsOf: (id: string) => OrgPerson[];
  pending: Record<string, true>;
  counts: Record<OrgDepartmentId, number>;
  add: (target: AddTarget) => void;
  openDept: (id: OrgDepartmentId) => void;
}

const Ctx = React.createContext<ChartCtx | null>(null);

function useChart() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("OrgChart parts must render inside <OrgChartCard>");
  return v;
}

export function OrgChartCard() {
  const { people, pending } = useOrg();
  const reduce = useReducedMotion();
  const [view, setView] = React.useState<OrgView>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [target, setTarget] = React.useState<AddTarget | null>(null);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const canvasRef = React.useRef<CanvasHandle>(null);

  const chart = React.useMemo(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const beneath = new Map<string, OrgPerson[]>();
    for (const p of people) {
      if (!p.managerId || p.link) continue;
      beneath.set(p.managerId, [...(beneath.get(p.managerId) ?? []), p]);
    }
    const counts = Object.fromEntries(ORG_DEPARTMENTS.map((d) => [d.id, 0])) as Record<OrgDepartmentId, number>;
    for (const p of people) if (p.name) counts[orgDepartmentOf(people, p.id)] += 1;
    return { byId, reportsOf: (id: string) => beneath.get(id) ?? [], counts };
  }, [people]);

  const named = people.filter((p) => p.name).length;
  const vacant = people.length - named;

  const add = React.useCallback((t: AddTarget) => {
    setTarget(t);
    setDialogOpen(true);
  }, []);

  const ctx = React.useMemo<ChartCtx>(
    () => ({ ...chart, pending, add, openDept: setView }),
    [chart, pending, add],
  );

  // Show who was just added: switch to their department if another one is on
  // screen, then zoom in on their seat once it has been drawn.
  const onAdded = (id: string, anchorId: string) => {
    const dept = orgDepartmentOf(people, anchorId);
    if (view !== "all" && view !== dept) setView(dept);
    setFocusId(id);
  };

  React.useEffect(() => {
    if (!focusId) return;
    const raf = requestAnimationFrame(() => {
      canvasRef.current?.reveal(focusId);
      setFocusId(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [focusId]);

  const root = people.find((p) => p.managerId === null);

  return (
    <Ctx.Provider value={ctx}>
      <Card>
        <CardHeader>
          <CardTitle>Organisation chart</CardTitle>
          <CardMeta>
            <span>
              {named} people{vacant ? ` · ${vacant} vacant` : ""}
            </span>
            <Button
              size="sm"
              onClick={() => add({ mode: "add", departmentId: view === "all" ? undefined : view })}
            >
              <UserPlus /> Add person
            </Button>
          </CardMeta>
        </CardHeader>

        <ChartCanvas
          ref={canvasRef}
          view={view}
          toolbar={
            <SlidingTabs
              value={view}
              onChange={setView}
              ariaLabel="Show department"
              items={[
                { value: "all" as OrgView, label: "Whole company", count: named },
                ...ORG_DEPARTMENTS.map((d) => ({ value: d.id as OrgView, label: d.name, count: chart.counts[d.id] })),
              ]}
            />
          }
        >
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
          >
            {!root ? null : view === "all" || view === "leadership" ? (
              <RootBlock person={root} summary={view === "leadership"} />
            ) : (
              <DepartmentTree id={view} />
            )}
          </motion.div>
        </ChartCanvas>

        <CardFooter className="flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {(Object.keys(ORG_BRANDS) as OrgBrand[]).map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className={cn("h-3 w-1 rounded-full", RIM[b])} aria-hidden />
              {ORG_BRANDS[b].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-full bg-border" aria-hidden />
            Group services
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] border border-dashed border-zinc-400 dark:border-zinc-500" aria-hidden />
            Vacant seat
          </span>
          <span className="text-subtle-foreground sm:ml-auto">
            Double-click or Ctrl + scroll to zoom · drag to move · + under a seat adds someone
          </span>
        </CardFooter>
      </Card>

      <AddPersonDialog
        open={dialogOpen}
        target={target}
        onClose={() => setDialogOpen(false)}
        onAdded={onAdded}
      />
    </Ctx.Provider>
  );
}

/** Zoom range: never smaller than the fitted whole, at most twice actual size. */
const MAX_ZOOM = 2;
const MIN_ZOOM = 0.1;
const ZOOM_STEP = 1.25;
/** Room between the chart and the panel's edges, in screen pixels. */
const PAD = 32;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface Point {
  x: number;
  y: number;
}

/** While zooming, chart point `at` (chart pixels) travels from screen point `from` to `to` (panel pixels). */
interface ZoomFocus {
  at: Point;
  from: Point;
  to: Point;
}

export interface CanvasHandle {
  /** Zoom to at least 100% and bring a seat to the middle of the panel. */
  reveal: (id: string) => void;
}

/**
 * The chart's own panel: a fixed-height window the chart is navigated inside,
 * map-style. The chart is laid out at full size, then scaled; a sizer around
 * it gives the scroll area the scaled size, so scrolling, dragging and the
 * scrollbars all work on what is on screen. Each view opens fitted and
 * centred. Plain scroll pans inside the panel (never scrolling the page past
 * it at an edge); Ctrl/Cmd + scroll and trackpad pinch zoom about the pointer.
 */
const ChartCanvas = React.forwardRef<
  CanvasHandle,
  { view: OrgView; toolbar: React.ReactNode; children: React.ReactNode }
>(function ChartCanvas({ view, toolbar, children }, handle) {
  const reduce = useReducedMotion();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = React.useState({ w: 0, h: 0 });
  const [panel, setPanel] = React.useState({ w: 0, h: 0 });
  /** The panel's outer width, scrollbar included, so it holds still while zooming. */
  const [frameW, setFrameW] = React.useState(0);
  const [zoom, setZoom] = React.useState<number | "fit">("fit");
  const [expanded, setExpanded] = React.useState(false);
  const [panning, setPanning] = React.useState(false);
  const pendingScroll = React.useRef<Point | null>(null);
  const anim = React.useRef<{ stop: () => void } | null>(null);
  const drag = React.useRef<{ x: number; y: number; left: number; top: number; id: number; moved: boolean } | null>(
    null,
  );

  const fit =
    chartSize.w && panel.w
      ? clamp(Math.min((panel.w - 2 * PAD) / chartSize.w, (panel.h - 2 * PAD) / chartSize.h), MIN_ZOOM, 1)
      : 1;
  const scale = zoom === "fit" ? fit : clamp(zoom, fit, MAX_ZOOM);
  // Where the scaled chart sits in the scroll area: centred while it is
  // smaller than the panel, PAD in from the edge once it is bigger.
  const offX = (k: number) => Math.max(PAD, (panel.w - chartSize.w * k) / 2);
  const offY = (k: number) => Math.max(PAD, (panel.h - chartSize.h * k) / 2);
  const width = Math.max(panel.w, chartSize.w * scale + 2 * PAD);
  const height = Math.max(panel.h, chartSize.h * scale + 2 * PAD);
  const canPan = width > panel.w + 1 || height > panel.h + 1;
  // The panel's height follows the chart's shape at fit-to-width, within
  // limits, so a long, low chart doesn't float in a tall empty box. It depends
  // only on the chart and the panel's width, never the zoom.
  const widthFit = chartSize.w && frameW ? Math.min(1, (frameW - 2 * PAD) / chartSize.w) : 1;
  const panelHeight = `clamp(min(28rem, 80vw), ${Math.round(chartSize.h * widthFit + 2 * PAD)}px, 68vh)`;

  // The latest geometry, for listeners and animation frames that outlive a render.
  const geo = React.useRef({ scale, fit, offX, offY, panel });
  geo.current = { scale, fit, offX, offY, panel };

  const measure = React.useCallback(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    // offsetWidth/Height ignore the scale: the chart's own laid-out size.
    const c = { w: content.offsetWidth, h: content.offsetHeight };
    const p = { w: el.clientWidth, h: el.clientHeight };
    setChartSize((s) => (s.w === c.w && s.h === c.h ? s : c));
    setPanel((s) => (s.w === p.w && s.h === p.h ? s : p));
    setFrameW(el.offsetWidth);
  }, []);

  // Before paint on every render (a view switch, an added seat), and again
  // whenever fonts loading or the window resizing changes either size.
  React.useLayoutEffect(measure);
  React.useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(content);
    return () => ro.disconnect();
  }, [measure, expanded]);

  // A zoom step sets the scroll it needs once the sizer has its new size.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    const to = pendingScroll.current;
    if (!el || !to) return;
    el.scrollLeft = to.x;
    el.scrollTop = to.y;
    pendingScroll.current = null;
  });

  // Each view opens fitted.
  React.useLayoutEffect(() => {
    anim.current?.stop();
    setZoom("fit");
    pendingScroll.current = { x: 0, y: 0 };
  }, [view]);

  /** Zoom about a screen point (panel pixels), or the middle of the panel. */
  const focusOn = (p?: Point): ZoomFocus => {
    const el = scrollRef.current!;
    const g = geo.current;
    const at = p ?? { x: g.panel.w / 2, y: g.panel.h / 2 };
    return {
      at: { x: (el.scrollLeft + at.x - g.offX(g.scale)) / g.scale, y: (el.scrollTop + at.y - g.offY(g.scale)) / g.scale },
      from: at,
      to: at,
    };
  };

  const pointer = (clientX: number, clientY: number): Point => {
    const r = scrollRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const zoomTo = (next: number | "fit", focus?: ZoomFocus, animated = true) => {
    if (!scrollRef.current) return;
    const g = geo.current;
    const target = next === "fit" ? g.fit : clamp(next, g.fit, MAX_ZOOM);
    const toFit = target <= g.fit + 0.001;
    const f = focus ?? focusOn();
    const from = g.scale;
    anim.current?.stop();
    const frame = (t: number) => {
      const k = from + (target - from) * t;
      pendingScroll.current = {
        x: f.at.x * k + g.offX(k) - (f.from.x + (f.to.x - f.from.x) * t),
        y: f.at.y * k + g.offY(k) - (f.from.y + (f.to.y - f.from.y) * t),
      };
      setZoom(t >= 1 && toFit ? "fit" : k);
    };
    if (!animated || reduce) {
      frame(1);
      return;
    }
    anim.current = animate(0, 1, {
      duration: DURATION.swap,
      ease: EASE_OUT,
      onUpdate: frame,
      onComplete: () => frame(1),
    });
  };
  const zoomRef = React.useRef(zoomTo);
  zoomRef.current = zoomTo;

  React.useImperativeHandle(
    handle,
    () => ({
      reveal(id) {
        const el = scrollRef.current;
        const content = contentRef.current;
        const seat = content?.querySelector<HTMLElement>(`[data-org-id="${id}"]`);
        if (!el || !content || !seat) return;
        const g = geo.current;
        const c = content.getBoundingClientRect();
        const s = seat.getBoundingClientRect();
        const v = el.getBoundingClientRect();
        zoomRef.current(Math.max(g.scale, 1), {
          at: { x: (s.left - c.left + s.width / 2) / g.scale, y: (s.top - c.top + s.height / 2) / g.scale },
          from: { x: s.left - v.left + s.width / 2, y: s.top - v.top + s.height / 2 },
          to: { x: g.panel.w / 2, y: g.panel.h / 2 },
        });
      },
    }),
    [],
  );

  // Ctrl/Cmd + scroll (and trackpad pinch, which arrives as one) zooms about
  // the pointer. React's wheel handler is passive, so this one is attached by hand.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const at = pointer(e.clientX, e.clientY);
      zoomRef.current(geo.current.scale * Math.exp(-e.deltaY * 0.0025), focusOn(at), false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // focusOn and pointer only read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const toggleExpanded = () => {
    anim.current?.stop();
    setZoom("fit");
    pendingScroll.current = { x: 0, y: 0 };
    setExpanded((v) => !v);
  };

  // Full screen: Escape backs out, unless a dialog is open over the chart (it
  // takes that Escape for itself).
  React.useEffect(() => {
    if (!expanded) return;
    scrollRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('[role="dialog"]')) return;
      toggleExpanded();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const endDrag = () => {
    drag.current = null;
    setPanning(false);
  };

  const pct = Math.round(scale * 100);

  const controls = (
    <div className="ml-auto flex shrink-0 items-center gap-1.5">
      <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-xs dark:bg-white/[0.03]">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Zoom out"
          disabled={scale <= fit + 0.001}
          onClick={() => zoomTo(scale / ZOOM_STEP)}
        >
          <Minus />
        </Button>
        <button
          type="button"
          onClick={() => zoomTo(1)}
          title="Show at 100%"
          aria-label={`Zoom ${pct}%. Show at 100%`}
          className="h-6 w-11 cursor-pointer rounded-md text-xs font-medium text-muted-foreground tabular-nums transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
        >
          {pct}%
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Zoom in"
          disabled={scale >= MAX_ZOOM - 0.001}
          onClick={() => zoomTo(scale * ZOOM_STEP)}
        >
          <Plus />
        </Button>
      </div>
      <Button variant="outline" size="sm" onClick={() => zoomTo("fit")} disabled={zoom === "fit"}>
        <Scan /> Fit
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={expanded ? "Exit full screen" : "Full screen"}
        title={expanded ? "Exit full screen (Esc)" : "Full screen"}
        onClick={toggleExpanded}
      >
        {expanded ? <Minimize2 /> : <Maximize2 />}
      </Button>
    </div>
  );

  const body = (
    <div className={cn(expanded && "fixed inset-0 z-[70] flex flex-col bg-background text-foreground")}>
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pb-3", expanded ? "pt-4" : "pt-1")}>
        {expanded ? (
          <h2 className="mr-2 font-heading text-[15px] leading-snug font-bold tracking-tight">Organisation chart</h2>
        ) : null}
        <div className="max-w-full min-w-0">{toolbar}</div>
        {controls}
      </div>
      <div
        className={cn("relative border-t border-hairline bg-canvas/50", expanded && "min-h-0 flex-1")}
        style={expanded ? undefined : { height: panelHeight }}
      >
        <div
          ref={scrollRef}
          role="region"
          aria-label="Organisation chart. Double-click, or press plus and minus, to zoom."
          tabIndex={0}
          className={cn(
            "absolute inset-0 overflow-auto overscroll-contain select-none [scrollbar-width:thin] focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none focus-visible:ring-inset",
            canPan && "cursor-grab",
            panning && "cursor-grabbing",
          )}
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest("button, a, input")) return;
            const at = pointer(e.clientX, e.clientY);
            if (scale < 0.95) zoomTo(1, focusOn(at));
            else if (scale > fit + 0.01) zoomTo("fit");
            else zoomTo(scale * 1.5, focusOn(at));
          }}
          onKeyDown={(e) => {
            if (e.key === "+" || e.key === "=") zoomTo(scale * ZOOM_STEP);
            else if (e.key === "-" || e.key === "_") zoomTo(scale / ZOOM_STEP);
            else if (e.key === "0") zoomTo("fit");
            else return;
            e.preventDefault();
          }}
          onPointerDown={(e) => {
            if (!canPan || e.pointerType !== "mouse" || e.button !== 0) return;
            if ((e.target as HTMLElement).closest("button, a, input")) return;
            anim.current?.stop();
            const el = e.currentTarget;
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              left: el.scrollLeft,
              top: el.scrollTop,
              id: e.pointerId,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (!d.moved) {
              if (Math.hypot(dx, dy) < 4) return;
              d.moved = true;
              e.currentTarget.setPointerCapture(d.id);
              setPanning(true);
            }
            e.currentTarget.scrollLeft = d.left - dx;
            e.currentTarget.scrollTop = d.top - dy;
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="relative bg-[radial-gradient(circle,var(--border)_1px,transparent_1.5px)] bg-[length:20px_20px]"
            style={{ width, height }}
          >
            <div
              ref={contentRef}
              className="absolute top-0 left-0 w-max origin-top-left"
              style={{ transform: `translate(${offX(scale)}px, ${offY(scale)}px) scale(${scale})` }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!expanded) return body;
  return (
    <>
      <div
        className="flex flex-col items-center justify-center gap-3 border-t border-hairline text-[13px] text-muted-foreground"
        style={{ height: panelHeight }}
      >
        The chart is open full screen.
        <Button variant="outline" size="sm" onClick={toggleExpanded}>
          <Minimize2 /> Exit full screen
        </Button>
      </div>
      {createPortal(body, document.body)}
    </>
  );
});

/**
 * The managing director with the board seat beside them on a dotted line and
 * their assistant off the stem, then the department heads. `summary` (the
 * Leadership view) stops at the heads, each with its headcount.
 */
function RootBlock({ person, summary }: { person: OrgPerson; summary: boolean }) {
  const { byId, reportsOf } = useChart();
  const beside = [...byId.values()].filter((p) => p.managerId === person.id && p.link);
  const peers = beside.filter((p) => p.link === "peer");
  const assistants = beside.filter((p) => p.link === "assistant");
  const heads = reportsOf(person.id);
  // Side columns wide enough for a seat plus its connector, so the director
  // stays centred over the departments.
  const row = "grid w-full grid-cols-[minmax(14rem,1fr)_auto_minmax(14rem,1fr)]";

  return (
    <div className="flex flex-col items-center">
      <div className={cn(row, "items-center")}>
        <span />
        <PersonNode person={person} root />
        <div className="flex flex-col items-start gap-3">
          {peers.map((p) => (
            <div key={p.id} className="flex items-center">
              <span aria-hidden className="w-8 border-t border-dashed border-zinc-400 dark:border-zinc-500" />
              <PersonNode person={p} side />
            </div>
          ))}
        </div>
      </div>
      {assistants.length ? (
        <div className={row}>
          <span />
          <span aria-hidden className={cn("w-px", LINE)} />
          <div className="flex flex-col items-start gap-3 py-4">
            {assistants.map((p) => (
              <div key={p.id} className="flex items-center">
                <span aria-hidden className={cn("h-px w-8", LINE)} />
                <PersonNode person={p} side />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {heads.length ? (
        <FanOut
          columns={heads.map((h) => (summary ? <HeadSummary key={h.id} person={h} /> : <Subtree key={h.id} person={h} />))}
        />
      ) : null}
    </div>
  );
}

/** Leadership view: a department head and how many people sit in their department. */
function HeadSummary({ person }: { person: OrgPerson }) {
  const { counts, openDept } = useChart();
  const dept = ORG_DEPARTMENTS.find((d) => d.id !== "leadership" && d.headId === person.id);
  return (
    <div className="flex flex-col items-center">
      <PersonNode person={person} />
      {dept ? (
        <Button
          variant="link"
          size="xs"
          className="mt-3.5 h-auto gap-1 px-0 text-xs"
          onClick={() => openDept(dept.id)}
        >
          {counts[dept.id]} {counts[dept.id] === 1 ? "person" : "people"} in {dept.name} <ArrowRight aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

function DepartmentTree({ id }: { id: OrgDepartmentId }) {
  const { byId } = useChart();
  const head = byId.get(orgDepartment(id).headId);
  return head ? <Subtree person={head} root /> : null;
}

function Subtree({ person, root }: { person: OrgPerson; root?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <PersonNode person={person} root={root} />
      <Branches parentId={person.id} />
    </div>
  );
}

/**
 * What hangs under a seat. Reports who lead people fan out as columns; the
 * rest are grouped (team blocks, then a rail of single seats) so a manager of
 * thirteen advocates is one column, not thirteen.
 */
function Branches({ parentId }: { parentId: string }) {
  const { reportsOf } = useChart();
  const kids = reportsOf(parentId);
  if (!kids.length) return null;

  const leads = kids.filter((k) => reportsOf(k.id).length > 0);
  const rest = kids.filter((k) => reportsOf(k.id).length === 0);
  const teams = new Map<string, OrgPerson[]>();
  for (const p of rest) if (p.team) teams.set(p.team, [...(teams.get(p.team) ?? []), p]);
  const blocks = [...teams].map(([team, members]) => (
    <TeamBlock key={`team:${team}`} managerId={parentId} team={team} members={members} />
  ));
  const singles = rest.filter((p) => !p.team).map((p) => <PersonNode key={p.id} person={p} />);

  if (!leads.length) {
    return (
      <>
        <span aria-hidden className={cn("h-4 w-px shrink-0", LINE)} />
        <Stack items={[...blocks, ...singles]} />
      </>
    );
  }

  return (
    <FanOut
      columns={[
        ...leads.map((p) => <Subtree key={p.id} person={p} />),
        ...blocks,
        ...(singles.length ? [<Stack key="singles" items={singles} />] : []),
      ]}
    />
  );
}

/** Columns hung off one bar: a stem down from the parent, a bar across, a drop into each column. */
function FanOut({ columns }: { columns: React.ReactElement[] }) {
  const last = columns.length - 1;
  return (
    <>
      <span aria-hidden className={cn("h-4 w-px shrink-0", LINE)} />
      <div className="flex items-start">
        {columns.map((col, i) => (
          <div key={col.key} className="relative flex flex-col items-center px-2 pt-4">
            {last > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 h-px",
                  LINE,
                  i === 0 ? "right-0 left-1/2" : i === last ? "right-1/2 left-0" : "inset-x-0",
                )}
              />
            ) : null}
            <span aria-hidden className={cn("absolute top-0 left-1/2 h-4 w-px", LINE)} />
            {col}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Seats down a rail on the left, the paper chart's way of listing reports who
 * lead no one. The line arriving from above lands on the rail's top centre.
 */
function Stack({ items }: { items: React.ReactElement[] }) {
  if (items.length === 1) return items[0];
  const last = items.length - 1;
  return (
    <div className="relative">
      <span aria-hidden className={cn("absolute top-0 right-1/2 left-2 h-px", LINE)} />
      <ul className="flex flex-col pl-5">
        {items.map((item, i) => (
          <li key={item.key} className="relative pt-3">
            <span
              aria-hidden
              className={cn("absolute top-0 -left-3 w-px", LINE, i === last ? "h-[calc(50%+6px)]" : "bottom-0")}
            />
            <span aria-hidden className={cn("absolute top-[calc(50%+6px)] -left-3 h-px w-3", LINE)} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A coloured strip down a seat's left edge, one band per sub-brand it works for. */
function BrandRim({ brands }: { brands?: OrgBrand[] }) {
  if (!brands?.length) return null;
  return (
    <span aria-hidden className="absolute inset-y-0 left-0 flex w-1 flex-col">
      {brands.map((b) => (
        <span key={b} className={cn("flex-1", RIM[b])} />
      ))}
    </span>
  );
}

function PersonNode({ person: p, root, side }: { person: OrgPerson; root?: boolean; side?: boolean }) {
  const { pending, add } = useChart();
  const adding = Boolean(pending[p.id]);
  const vacant = p.name === null;
  const label = p.name ?? `Vacant ${p.role}`;

  return (
    <div data-org-id={p.id} className="group/node relative w-48 shrink-0">
      <div
        className={cn(
          "relative flex items-start gap-2.5 overflow-hidden rounded-lg border bg-card py-2.5 pr-3 pl-3.5 shadow-xs transition-[opacity,border-color] duration-200",
          root ? "border-zinc-400 dark:border-zinc-500" : "border-border",
          vacant && "border-dashed border-zinc-400 bg-canvas shadow-none dark:border-zinc-500",
          adding && "border-dashed border-tone-strong opacity-75",
        )}
      >
        <BrandRim brands={p.brands} />
        {vacant ? (
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-400 text-subtle-foreground dark:border-zinc-500"
          >
            <UserRound className="size-3.5" />
          </span>
        ) : (
          <Avatar name={p.name!} tone={avatarTone(p.brands)} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-tight font-semibold break-words">
            {vacant ? <span className="text-muted-foreground">Vacant</span> : p.name}
            {p.note ? <span className="font-normal text-muted-foreground"> ({p.note})</span> : null}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {p.role}
            <span className="sr-only"> · {brandWords(p.brands)}</span>
          </p>
          {p.transition ? (
            <p className="mt-1 text-xs leading-snug text-amber-700 dark:text-amber-300">
              {p.transition} (transition)
            </p>
          ) : null}
          {adding ? (
            <Pill tone="neutral" className="mt-1.5 px-2 py-0">
              Adding…
            </Pill>
          ) : p.isNew ? (
            <Pill tone="tone" className="mt-1.5 px-2 py-0">
              New
            </Pill>
          ) : vacant ? (
            <Button
              variant="link"
              size="xs"
              className="mt-1 h-auto px-0 text-xs"
              onClick={() => add({ mode: "fill", seatId: p.id })}
            >
              Fill seat
            </Button>
          ) : null}
        </div>
      </div>
      {side || adding ? null : (
        <button
          type="button"
          onClick={() => add({ mode: "add", managerId: p.id })}
          aria-label={`Add someone under ${label}`}
          title={`Add someone under ${p.name ?? "this seat"}`}
          className="absolute -bottom-2.5 left-1/2 z-10 flex size-5 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-subtle-foreground opacity-0 shadow-xs transition-[opacity,color,border-color] duration-150 group-hover/node:opacity-100 pointer-coarse:opacity-100 hover:border-tone-strong hover:text-tone-ink focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
        >
          <Plus className="size-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A manager's like seats as one block, like the paper chart's coloured lists. */
function TeamBlock({ managerId, team, members }: { managerId: string; team: string; members: OrgPerson[] }) {
  const { pending, add, byId } = useChart();
  const brand = members[0]?.brands?.[0] ?? "group";
  const wash = WASH[brand];
  const manager = byId.get(managerId);

  return (
    <div className={cn("w-48 shrink-0 overflow-hidden rounded-lg border", wash.box)}>
      <p className={cn("flex items-baseline gap-2 px-3 pt-2.5 pb-1.5", wash.ink)}>
        <span className="min-w-0 flex-1 text-[10px] leading-tight font-semibold tracking-[0.12em] uppercase">
          {team}
        </span>
        <span className="text-[10px] font-semibold tabular-nums">{members.length}</span>
      </p>
      <ul className="px-1.5 pb-1">
        {members.map((m) => {
          const adding = Boolean(pending[m.id]);
          return (
            <li
              key={m.id}
              data-org-id={m.id}
              className={cn("flex items-center gap-2 rounded-md px-1.5 py-1", adding && "opacity-70")}
            >
              <Avatar name={m.name ?? "?"} tone={avatarTone(m.brands)} size="xs" />
              <span className="min-w-0 flex-1 truncate text-[13px]" title={m.name ?? undefined}>
                {m.name ?? "Vacant"}
                {m.note ? <span className="text-muted-foreground"> ({m.note})</span> : null}
                {m.role !== members[0].role ? <span className="sr-only"> · {m.role}</span> : null}
              </span>
              {adding ? (
                <span className="text-xs text-subtle-foreground">Adding…</span>
              ) : m.isNew ? (
                <Pill tone="tone" className="px-1.5 py-0">
                  New
                </Pill>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => add({ mode: "add", managerId, team })}
        aria-label={`Add to ${team} under ${manager?.name ?? manager?.role ?? "this manager"}`}
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 border-t border-black/5 px-3 py-2 text-xs font-medium transition-colors hover:bg-black/[0.03] focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none focus-visible:ring-inset dark:border-white/10 dark:hover:bg-white/5",
          wash.ink,
        )}
      >
        <Plus className="size-3" aria-hidden /> Add to team
      </button>
    </div>
  );
}
