"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, FileText, PlayCircle, Sparkles, Upload } from "lucide-react";
import { confirm } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { SearchInput } from "@/components/ui/input";
import { NoMatches } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { useNavReselect, useNavState } from "@/components/shell/nav-state";
import { AddMaterialDialog } from "./AddMaterialDialog";
import { KnowledgeOverview } from "./KnowledgeOverview";
import {
  CATEGORIES,
  CATEGORY_SLUGS,
  MATERIALS,
  POPULAR,
  categoryForSlug,
  type Category,
  type Material,
  type MaterialKind,
} from "./data";

/**
 * Knowledge base — the mockup's `Sm` (no tabs): category chips with their
 * material counts, the latest materials in the chosen category, and the Jarvis
 * note. Added for the port: a search across every category (with Home's
 * "Popular right now" titles as one-tap searches, and `?q=` to pre-fill it),
 * "Add material" (the mockup's button had no handler) and opening a material.
 */
interface Row extends Material {
  category: Category;
}

export function KnowledgeScreen() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramQuery = params.get("q") ?? "";

  // The category lives in `?cat=` and is chosen in the Knowledge rail. With no
  // category (and no search to show) the page is Knowledge's Overview.
  const category = categoryForSlug(params.get("cat"));
  const overview = (params.get("cat") ?? "overview") === "overview" && !paramQuery;
  const setCategory = React.useCallback(
    (cat: Category) => router.replace(`${pathname}?cat=${CATEGORY_SLUGS[cat]}`, { scroll: false }),
    [router, pathname],
  );
  const [materials, setMaterials] = React.useState<Record<Category, Material[]>>(MATERIALS);
  const [query, setQuery] = React.useState(paramQuery);
  const [adding, setAdding] = React.useState(false);

  // A deep link (`/knowledge?q=…`) re-seeds the search if it changes while mounted.
  React.useEffect(() => setQuery(paramQuery), [paramQuery]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const rows: Row[] = searching
    ? CATEGORIES.flatMap((c) => materials[c.name].map((m) => ({ ...m, category: c.name }))).filter((r) =>
        `${r.title} ${r.meta} ${r.category}`.toLowerCase().includes(q),
      )
    : materials[category].map((m) => ({ ...m, category }));

  // Choosing a category in the rail clears the search (a new ?cat= arrives)…
  const catParam = params.get("cat");
  React.useEffect(() => {
    setQuery(params.get("q") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catParam]);
  // …and so does re-clicking the category that is already open.
  useNavReselect("knowledge:", () => setQuery(""));

  // Category totals on the rail. The mockup's counts are category totals;
  // materials added here add to them.
  const counts = CATEGORIES.map((c) => c.count + (materials[c.name].length - MATERIALS[c.name].length));
  const countKey = counts.join(",");
  const { setBadge } = useNavState();
  React.useEffect(() => {
    CATEGORIES.forEach((c, i) => setBadge(`knowledge:${CATEGORY_SLUGS[c.name]}`, { count: counts[i], tone: "neutral", label: "materials" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countKey, setBadge]);
  React.useEffect(
    () => () => CATEGORIES.forEach((c) => setBadge(`knowledge:${CATEGORY_SLUGS[c.name]}`, null)),
    [setBadge],
  );
  const current = CATEGORIES.find((c) => c.name === category) ?? CATEGORIES[0];
  const CurrentIcon = current.icon;

  const openMaterial = (r: Row) =>
    confirm(r.kind === "video" ? `Playing “${r.title}”` : `Opening “${r.title}”`, `${r.category} · ${r.meta}`);

  const addMaterial = (cat: Category, title: string, kind: MaterialKind) => {
    setMaterials((prev) => ({ ...prev, [cat]: [{ id: `added-${Date.now()}`, title, meta: "New", kind }, ...prev[cat]] }));
    setCategory(cat);
    setQuery("");
    setAdding(false);
    confirm("Material added", `${title} · ${cat}`);
  };

  if (overview) {
    return (
      <PageContainer>
        <KnowledgeOverview materials={materials} counts={counts} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Knowledge base"
        description="Everything the team needs in one place: procedures, builder requirements, training videos and systems reference. Replaces the documents scattered across email and SharePoint."
        actions={
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Upload className="size-3.5" /> Add material
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <Reveal index={0} className="flex flex-col gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            count={searching ? rows.length : undefined}
            placeholder="Search the knowledge base"
            aria-label="Search the knowledge base"
          />
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Popular right now">
            <span className="mr-1 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
              Popular right now
            </span>
            {POPULAR.map((p) => {
              const on = q === p.query.toLowerCase();
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setQuery(on ? "" : p.query)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                    on
                      ? "border-tone-strong bg-tone-soft text-tone-ink"
                      : "border-border bg-card text-tone-ink hover:border-tone-line hover:bg-tone-soft/70 dark:bg-white/[0.03] dark:hover:bg-tone-soft",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

        </Reveal>

        <Reveal index={1}>
          <Card className="overflow-hidden">
            {searching ? (
              <CardHeader className="border-b border-hairline pb-3">
                <CardTitle as="h2" className="text-sm">
                  Results across all categories
                </CardTitle>
                <CardMeta>
                  {rows.length} {rows.length === 1 ? "match" : "matches"}
                </CardMeta>
              </CardHeader>
            ) : (
              // The category comes from the rail, so the list says which one it is.
              <CardHeader className="border-b border-hairline pb-3">
                <CurrentIcon className="size-4 text-subtle-foreground" aria-hidden />
                <CardTitle as="h2" className="text-sm">
                  {current.name}
                </CardTitle>
                {/* The library holds more than this list shows: say so, and point at search. */}
                <CardMeta>
                  Latest {rows.length} of {counts[CATEGORIES.indexOf(current)]} · search finds the rest
                </CardMeta>
              </CardHeader>
            )}
            {rows.length === 0 ? (
              <NoMatches query={query} onClear={() => setQuery("")} />
            ) : (
              <ul aria-label={searching ? "Search results" : category}>
                {rows.map((r, i) => (
                  <motion.li
                    key={`${r.category}/${r.id ?? r.title}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.05, 0.25) }}
                    className="border-t border-hairline first:border-t-0"
                  >
                    <button
                      type="button"
                      onClick={() => openMaterial(r)}
                      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-tone-soft/70 focus-visible:bg-tone-soft/70 focus-visible:outline-none sm:px-5"
                    >
                      {r.kind === "video" ? (
                        <PlayCircle className="size-4 shrink-0 text-tone-ink" aria-hidden />
                      ) : (
                        <FileText className="size-4 shrink-0 text-tone-ink" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium">
                          <Highlight text={r.title} query={q} />
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {searching ? <span>{r.category} ·</span> : null}
                          {r.meta === "New" ? (
                            <Pill tone="tone" className="px-2 py-0 text-xs">
                              New
                            </Pill>
                          ) : (
                            <span>{r.meta}</span>
                          )}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-3.5 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden
                      />
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>

        <Reveal index={2}>
          <div className="flex items-center gap-2.5 rounded-xl border border-tone-line bg-tone-soft px-3.5 py-3">
            <Sparkles className="size-3.5 shrink-0 text-tone-ink" aria-hidden />
            <span className="text-xs text-foreground">
              Ask Jarvis a question and it answers from these documents, citing which one it used.
            </span>
          </div>
        </Reveal>
      </div>

      <AddMaterialDialog
        open={adding}
        onClose={() => setAdding(false)}
        defaultCategory={category}
        onAdd={addMaterial}
      />
    </PageContainer>
  );
}

/** Bold the matched part of a title while searching. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const at = text.toLowerCase().indexOf(query);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-tone-tint px-0.5 text-inherit">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}
