"use client";

import * as React from "react";
import { toast } from "sonner";
import { CloudDownload, Database, Layers, LayoutGrid, ListChecks, TriangleAlert } from "lucide-react";
import type { ImportSummary, ImportWarning } from "@/data/homescope";
import { perthClock, perthDate } from "@/lib/perth-time";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { importCatalogueAction } from "@/server/actions/homescope";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { AutoHeight } from "@/components/ui/list-motion";
import { PageHeader } from "@/components/ui/page";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { SlidingTabs, TabPanels } from "@/components/ui/sliding-tabs";
import { useLiveCatalogue } from "@/components/modules/sales/costing/homescope/catalogue-context";
import { catalogueLabel } from "@/components/modules/sales/costing/homescope/catalogue-state";
import { BuilderCatalogue } from "./BuilderCatalogue";

const SHOWN = 6;

/** Every flagged item's name, since Ops need them all to fix the boards. Past six, the rest sit behind a button. */
function ItemNames({ items }: { items: string[] }) {
  const [all, setAll] = React.useState(false);
  if (items.length <= SHOWN) return <>{items.join(", ")}</>;
  return (
    <>
      {(all ? items : items.slice(0, SHOWN)).join(", ")}
      {all ? null : " "}
      {all ? null : (
        <button type="button" onClick={() => setAll(true)} className="font-medium underline underline-offset-2">
          Show all {items.length}
        </button>
      )}
    </>
  );
}

function importedMessage(r: ImportSummary): string {
  if (r.status === "failed") return `Import from Monday failed: ${r.error}`;
  const n = r.changed.length + r.retired.length;
  return n ? `Imported from Monday: ${n} builder${n === 1 ? "" : "s"} updated` : "Imported from Monday: no changes";
}

/** Items the last import flagged, board by board. */
function ImportWarnings({ warnings }: { warnings: ImportWarning[] }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b border-hairline pb-3">
        <CardTitle>To check on Monday</CardTitle>
        <CardMeta className="text-xs text-muted-foreground">
          What the last import flagged on the Estimation Source Data boards. Fix them there, then import again.
        </CardMeta>
      </CardHeader>
      <ul className="divide-y divide-hairline">
        {warnings.map((w) => (
          <li key={`${w.board}-${w.message}`} className="flex gap-3 px-5 py-3 text-[13px]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-tone-ink" aria-hidden />
            <div className="min-w-0">
              <p>
                <span className="font-medium">{w.board}</span>: <ItemNames items={w.items} /> {w.message}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Operations › HomeScope pricing (Meeting4, decision 5): the catalogue HomeScope
 * quotes from, builder by builder, as last imported from Monday's Estimation Source
 * Data boards. Read-only for now: Ops still edit on Monday, then press Import.
 */
export function HomeScopePricing() {
  const live = useLiveCatalogue();
  const { notify } = useLaunchpad();
  const [busy, setBusy] = React.useState(false);
  const [picked, setPicked] = React.useState<string | null>(null);
  const dirRef = React.useRef(0);
  const running = React.useRef(false);

  const builders = live.catalogue.builders;
  const current = builders.find((b) => b.name === picked) ?? builders[0] ?? null;
  const choose = (name: string) => {
    dirRef.current = Math.sign(builders.findIndex((b) => b.name === name) - builders.findIndex((b) => b.name === current?.name));
    setPicked(name);
  };

  const runImport = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const r = await importCatalogueAction();
      const msg = importedMessage(r);
      notify(msg, r.status === "ok" ? "ok" : "red");
      if (r.status === "ok") confirm(msg);
      else toast.error(msg);
      live.reload();
    } catch {
      const msg = "Import from Monday failed: the server didn't answer. Try again in a moment.";
      notify(msg, "red");
      toast.error(msg);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  if (live.status === "loading") return <ScreenSkeleton />;

  const last = live.lastImport;
  const totals = builders.reduce(
    (t, b) => ({ models: t.models + b.models.length, variations: t.variations + b.variations.length }),
    { models: 0, variations: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="HomeScope pricing"
        description="The builders, designs and prices HomeScope quotes from. Ops edit them on Monday's Estimation Source Data boards, then import them here."
        actions={
          <>
            <Pill tone="neutral" icon={Database}>
              {catalogueLabel(live.catalogue)}
            </Pill>
            <Button onClick={runImport} disabled={!live.live || busy} title={live.live ? undefined : "Live data isn't connected"}>
              <CloudDownload className="size-3.5" aria-hidden />
              {busy ? "Importing…" : "Import from Monday"}
            </Button>
          </>
        }
      />
      {live.note ? (
        <p role="status" className="-mt-3 text-xs text-muted-foreground">
          {live.note}
        </p>
      ) : null}

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard label="Builders" value={builders.length} sub={builders.map((b) => b.name).join(" · ")} icon={Layers} />
          <KpiCard label="Designs" value={totals.models} sub="on the Models board" icon={LayoutGrid} />
          <KpiCard label="Variations" value={totals.variations} sub="excluding bolt-on lines" icon={ListChecks} />
          <KpiCard
            label="Last import"
            value={last ? perthDate(last.finishedAt) : "Never"}
            sub={
              last
                ? `${perthClock(last.finishedAt)} · ${last.status === "ok" ? `${last.changed} changed` : "failed"} · ${last.calls} calls`
                : "Run one to read Monday"
            }
            icon={CloudDownload}
            tone={last?.status === "failed" ? "problem" : "charcoal"}
            alert={last?.status === "failed"}
          />
        </KpiGrid>
      </Reveal>

      {last?.status === "failed" && last.error ? (
        <Reveal index={1}>
          <Card className="px-5 py-3 text-[13px]">
            <span className="font-medium">The last import failed:</span> {last.error}
          </Card>
        </Reveal>
      ) : null}

      {last?.status === "ok" && last.warnings.length ? (
        <Reveal index={1}>
          <ImportWarnings warnings={last.warnings} />
        </Reveal>
      ) : null}

      {current ? (
        <Reveal index={2}>
          <div className="flex flex-col gap-4">
            <SlidingTabs
              value={current.name}
              onChange={choose}
              items={builders.map((b) => ({ value: b.name, label: b.name, count: b.models.length }))}
            />
            <AutoHeight>
              <TabPanels value={current.name} dir={dirRef.current} variant="slide">
                <BuilderCatalogue builder={current} />
              </TabPanels>
            </AutoHeight>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
