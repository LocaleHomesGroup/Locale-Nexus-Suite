"use client";

import type { ComponentType } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Laptop, Monitor, Smartphone } from "lucide-react";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { ASSETS, personTone, type Asset, type AssetStatus } from "../data";

/** In use = current (Haven), available = neutral info (Sky Blue), in repair = caution (amber). */
const STATUS_TONE: Record<AssetStatus, PillTone> = {
  "In use": "haven",
  Available: "skyblue",
  "In repair": "pending",
};

const CATEGORY_ICON: Record<Asset["category"], ComponentType<{ className?: string }>> = {
  Laptop,
  Phone: Smartphone,
  Peripheral: Monitor,
};

/** HR › Assets — the company equipment register. */
export function HrAssetsTab() {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="HR"
        title="Assets"
        description="Company equipment register · allocations and returns tracked in Horilla."
      />

      <Reveal index={0}>
        <Card className="min-w-0 overflow-hidden">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHead className="pl-5">Asset</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ASSETS.map((a, i) => {
                const Icon = CATEGORY_ICON[a.category];
                return (
                  <motion.tr
                    key={a.tag}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.04) }}
                    className="border-b border-hairline transition-colors hover:bg-haven-50/60 dark:hover:bg-haven-950/25"
                  >
                    <TableCell className="pl-5">
                      <span className="flex items-baseline gap-2 whitespace-nowrap">
                        <span className="font-medium">{a.name}</span>
                        <span className="rounded bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">
                          {a.tag}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="size-3.5 text-subtle-foreground" aria-hidden />
                        {a.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      {a.assignedTo ? (
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <Avatar name={a.assignedTo} tone={personTone(a.assignedTo)} size="xs" />
                          {a.assignedTo}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </TableCell>
                    <TableCell className="pr-5">
                      <Pill tone={STATUS_TONE[a.status]} variant="caps">
                        {a.status}
                      </Pill>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Reveal>
    </div>
  );
}
