"use client";

import * as React from "react";
import { FileUp, LoaderCircle, Upload } from "lucide-react";
import { aud } from "@/lib/utils";
import { undoable } from "@/lib/undoable";
import { DEVELOPER, PORTAL_TODAY } from "@/data/portal";
import { useLaunchpad } from "@/state/launchpad-store";
import type { PriceListStatus } from "@/components/modules/operations/pricing/data";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/input";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { SmoothSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DESIGNS, DOUBLE_STOREY_LOADING, PRICE_LIST, basePrice } from "./data";

const STATUS_TONE: Record<PriceListStatus, PillTone> = {
  Published: "ok",
  "In review": "pending",
  "Awaiting PDF": "problem",
};
const MONTHS = ["Sep 2026", "Oct 2026"] as const;
type Month = (typeof MONTHS)[number];

/**
 * Developer › Designs and pricing — the builder's designs as Locale's
 * consultants sell them, and the price list they're costed from. A new price
 * list goes to Locale Operations' Doc formatter (which turns builder PDFs into
 * Locale's format), so the builder sends it here instead of by email.
 */
export function DesignsPricing() {
  const { notify } = useLaunchpad();
  const [list, setList] = React.useState({
    version: PRICE_LIST.version,
    received: PRICE_LIST.received,
    status: PRICE_LIST.status,
    changes: PRICE_LIST.changes,
  });
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Month>(MONTHS[0]);
  const [file, setFile] = React.useState<string>("");
  const [sending, setSending] = React.useState(false);

  const send = () => {
    if (!file) return;
    setOpen(false);
    setSending(true);
    undoable({
      message: `Sending ${DEVELOPER}'s ${month} price list to Locale Operations`,
      description: `${file} · goes to the Doc formatter`,
      commit: () => {
        setList({ version: month, received: PORTAL_TODAY, status: "In review", changes: 0 });
        notify(`${DEVELOPER} sent its ${month} price list (Developer portal) · ready for the Doc formatter`);
        setSending(false);
        setFile("");
      },
      undo: () => setSending(false),
      done: { message: "Price list sent", description: `${month} · Locale Operations reviews it before it goes live` },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Designs and pricing"
        description="Your designs as Locale's consultants sell them, and the price list every package is costed from."
        actions={
          <Button onClick={() => setOpen(true)} disabled={sending} aria-busy={sending || undefined}>
            {sending ? (
              <>
                <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> Sending…
              </>
            ) : (
              <>
                <Upload aria-hidden /> Send a new price list
              </>
            )}
          </Button>
        }
      />

      <Reveal index={0}>
        <Card>
          <CardHeader>
            <CardTitle>Your price list on Locale</CardTitle>
            <CardMeta>
              <Pill tone={STATUS_TONE[list.status]} variant="caps">
                {list.status}
              </Pill>
            </CardMeta>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pb-5 sm:grid-cols-4">
            <Stat label="Version" value={list.version} />
            <Stat label="Received" value={list.received} />
            <Stat
              label="Rates changed"
              value={list.status === "In review" && list.changes === 0 ? "Being checked" : String(list.changes)}
            />
            <Stat label="Designs listed" value={String(DESIGNS.length)} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card>
          <CardHeader>
            <CardTitle>Your designs</CardTitle>
            <CardMeta>{DESIGNS.reduce((sum, d) => sum + d.packages, 0)} packages on Locale</CardMeta>
            <CardDescription>
              What a consultant sees when they put one of your homes in front of a client.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Design</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Base price</TableHead>
                    <TableHead className="text-right">Build time</TableHead>
                    <TableHead className="text-right">Packages</TableHead>
                    <TableHead className="pr-5 text-right">In a top four</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DESIGNS.map((d) => (
                    <TableRow key={d.name}>
                      <TableCell className="pl-5">
                        <span className="block font-medium">{d.name}</span>
                        <span className="block text-xs text-muted-foreground">{d.spec}</span>
                      </TableCell>
                      <TableCell className="tabular-nums">{d.size}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{aud(basePrice(d))}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.weeks} weeks</TableCell>
                      <TableCell className="text-right tabular-nums">{d.packages}</TableCell>
                      <TableCell className="pr-5 text-right tabular-nums">
                        {d.matched}
                        <span className="text-xs text-subtle-foreground"> · sample</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Base prices from your {PRICE_LIST.version} price list, single storey. Double storey adds{" "}
            {aud(DOUBLE_STOREY_LOADING)}. &ldquo;In a top four&rdquo; counts this quarter&rsquo;s consultations.
          </CardFooter>
        </Card>
      </Reveal>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        icon={FileUp}
        title="Send a new price list"
        description="Your PDF goes to Locale Operations, who check every rate change in the Doc formatter before it goes live for consultants. You get six seconds to undo."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={send} disabled={!file}>
              Send to Locale
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Price list for" htmlFor="pl-month">
            <SmoothSelect
              id="pl-month"
              value={month}
              onChange={setMonth}
              options={MONTHS.map((m) => ({ value: m, label: m }))}
            />
          </Field>
          <Field
            label="PDF"
            htmlFor="pl-file"
            hint="Nothing leaves your computer in the prototype: only the file name is kept."
          >
            <input
              id="pl-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")}
              className="block w-full cursor-pointer rounded-lg border border-dashed border-border bg-canvas/60 px-3 py-3 text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
