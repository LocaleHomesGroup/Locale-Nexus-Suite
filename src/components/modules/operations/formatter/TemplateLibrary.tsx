"use client";

import * as React from "react";
import { Folder, Upload } from "lucide-react";
import { toast } from "sonner";
import { confirm } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import type { TEMPLATE_LIBRARY } from "./data";

type Library = typeof TEMPLATE_LIBRARY;

/**
 * Doc formatter → Templates (admin only). Activating a version retires the
 * other versions of the same template, so only one is ever offered for new
 * jobs; jobs already run keep the version they pinned.
 */
export function TemplateLibrary({
  library,
  setLibrary,
}: {
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
}) {
  const toggle = (group: string, name: string, version: string, makeActive: boolean) => {
    setLibrary((prev) =>
      prev.map((g) =>
        g.group !== group
          ? g
          : {
              ...g,
              items: g.items.map((t) =>
                t.name !== name
                  ? t
                  : t.version === version
                    ? { ...t, active: makeActive }
                    : makeActive
                      ? { ...t, active: false }
                      : t,
              ),
            },
      ),
    );
    confirm(`${name} ${version} ${makeActive ? "activated" : "deactivated"}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Pill tone="skyblue">Admin only</Pill>
        <p className="min-w-0 flex-1 text-[11.5px] text-muted-foreground">
          Jobs pin the version they used, so old versions stay readable but only the active one is offered.
        </p>
        <Button
          onClick={() =>
            toast("Template upload isn't wired up yet", {
              description: "This is the static prototype — admins will add new template versions here.",
            })
          }
        >
          <Upload className="size-3.5" aria-hidden /> Upload template
        </Button>
      </div>

      {library.map((g, gi) => (
        <Reveal key={g.group} index={gi}>
          <Card>
            <CardHeader className="pb-1">
              <Folder className="size-3.5 text-muted-foreground" aria-hidden />
              <h2 className="text-xs font-semibold">{g.group}</h2>
            </CardHeader>
            <CardContent className="pb-2">
              <ul>
                {g.items.map((t) => (
                  <li
                    key={t.name + t.version}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-hairline py-2"
                  >
                    <span className={cn("text-[12.5px]", t.active ? "text-foreground" : "text-subtle-foreground")}>
                      {t.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {t.version} · created {t.created}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <Pill tone={t.active ? "ok" : "neutral"} variant="caps">
                        {t.active ? "Active" : "Inactive"}
                      </Pill>
                      <Button
                        variant="link"
                        size="xs"
                        className="w-[68px] justify-end text-[11px] font-semibold"
                        aria-label={`${t.active ? "Deactivate" : "Activate"} ${t.name} ${t.version}`}
                        onClick={() => toggle(g.group, t.name, t.version, !t.active)}
                      >
                        {t.active ? "Deactivate" : "Activate"}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      ))}
    </div>
  );
}
