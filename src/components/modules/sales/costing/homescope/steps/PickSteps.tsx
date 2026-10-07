"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileSignature, Home, Info, Palette, PenLine, TriangleAlert } from "lucide-react";
import { aud } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Pill } from "@/components/ui/pill";
import { CATALOGUE, PRE_START, groupByFrontage, modelsForBlock, rangesByLevel, stepIndex } from "../catalogue";
import { chooseBuilder, chooseColour, chooseElevation, chooseModel, chooseRange, useEstimate } from "../store";
import { ChoiceCard, ChoiceGrid, GroupLabel, Segmented } from "../parts";

/**
 * The steps that are one pick from a set of cards: builder, model, spec
 * range, front elevation and colour scheme (HomeScope steps 2–5 and 8).
 */

const initial = (s: string) => s.replace(/^[^A-Za-z0-9]+/, "").charAt(0).toUpperCase();

/** Step 2: the builders with at least one design that suits the block. */
export function BuilderStep() {
  const { estimate: e, reached } = useEstimate();
  const block = { corner: e.corner, min: e.min, max: e.max };
  const builders = CATALOGUE.builders
    .map((b) => ({ b, count: modelsForBlock(b, block).length }))
    .filter((x) => x.count > 0);
  const downstream = e.builder != null && reached > stepIndex("model");

  return (
    <div className="flex flex-col gap-4">
      {downstream ? (
        <Note>Choosing another builder clears the model, spec range, elevation and every step after them.</Note>
      ) : null}
      <ChoiceGrid>
        {builders.map(({ b, count }, i) => (
          <ChoiceCard
            key={b.name}
            group="builder"
            index={i}
            selected={e.builder === b.name}
            onSelect={() => chooseBuilder(b.name)}
            mark={initial(b.name)}
            title={b.name}
            sub={`${count} design${count === 1 ? "" : "s"} suit this block`}
            meta={b.address.replace(/, Australia$/, "")}
          />
        ))}
      </ChoiceGrid>
    </div>
  );
}

/** Step 3: the builder's designs for this block, in HomeScope's frontage groups. */
export function ModelStep() {
  const { estimate: e, pricing: p } = useEstimate();
  const b = p.builder;
  if (!b) return null;
  const block = { corner: e.corner, min: e.min, max: e.max };
  const groups = groupByFrontage(modelsForBlock(b, block), block);
  let n = 0;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.label}>
          <GroupLabel right={g.bestFit ? <Pill tone="tone">Best fit</Pill> : null}>{g.label}</GroupLabel>
          <ChoiceGrid>
            {g.models.map((m) => {
              const from = Math.min(...Object.values(m.prices));
              return (
                <ChoiceCard
                  key={m.name}
                  group="model"
                  index={n++}
                  selected={e.model === m.name}
                  onSelect={() => chooseModel(m.name)}
                  mark={initial(m.name)}
                  title={m.name}
                  sub={
                    [m.beds ? `${m.beds} bed` : null, m.baths ? `${m.baths} bath` : null, m.totalArea ? `${m.totalArea} m²` : null]
                      .filter(Boolean)
                      .join(" · ") || (m.frontage != null ? `Suits ${m.frontage}m frontage` : undefined)
                  }
                  meta={`From ${aud(from)}`}
                  aside={m.corner ? <Pill tone="neutral">Corner</Pill> : null}
                />
              );
            })}
          </ChoiceGrid>
        </section>
      ))}
    </div>
  );
}

/** Step 4: the builder's spec ranges by level, each priced for the chosen model. */
export function RangeStep() {
  const { estimate: e, pricing: p } = useEstimate();
  const b = p.builder;
  const m = p.model;
  if (!b || !m) return null;
  const levels = rangesByLevel(b);
  const lowest = Math.min(...b.ranges.map((r) => m.prices[r.column] ?? Infinity));
  let n = 0;

  return (
    <div className="flex flex-col gap-5">
      {levels.map((l) => (
        <section key={l.level}>
          <GroupLabel>{l.level}</GroupLabel>
          <ChoiceGrid>
            {l.ranges.map((r) => {
              const price = m.prices[r.column];
              const extra = price != null && price > lowest ? price - lowest : 0;
              return (
                <ChoiceCard
                  key={r.name}
                  group="range"
                  index={n++}
                  selected={e.range === r.name}
                  disabled={price == null}
                  onSelect={() => chooseRange(r.name)}
                  mark={initial(r.name)}
                  title={r.name}
                  sub={price == null ? `Not priced for the ${m.name}` : extra ? `+${aud(extra)} on the base range` : "The base range"}
                  aside={price != null ? aud(price) : null}
                />
              );
            })}
          </ChoiceGrid>
        </section>
      ))}
    </div>
  );
}

const elevationIcon = (name: string) =>
  /flyer|signed/i.test(name) ? <FileSignature className="size-4" /> : /custom/i.test(name) ? <PenLine className="size-4" /> : <Home className="size-4" />;

/** Step 5: the front elevations. Most cost nothing extra; any that do say so. */
export function ElevationStep() {
  const { estimate: e, pricing: p } = useEstimate();
  const b = p.builder;
  if (!b) return null;
  // Styles named for a frontage ("12.5m Gables", "15 Gable - G1") lead with the one that fits the model.
  const fits = (name: string) => p.model?.frontage != null && name.startsWith(String(p.model.frontage));
  const styles = [...b.elevations].sort((x, y) => Number(fits(y.name)) - Number(fits(x.name)));

  return (
    <ChoiceGrid>
      {styles.map((s, i) => (
        <ChoiceCard
          key={s.name}
          group="elevation"
          index={i}
          selected={e.elevation === s.name}
          onSelect={() => chooseElevation(s.name)}
          mark={elevationIcon(s.name)}
          title={s.name}
          sub={fits(s.name) ? `Drawn for a ${p.model?.frontage}m frontage like the ${p.model?.name}` : undefined}
          aside={s.price > 0 ? `+${aud(s.price)}` : <span className="font-normal text-subtle-foreground">Included</span>}
        />
      ))}
    </ChoiceGrid>
  );
}

/** Step 8: leave colours to pre-start (HomeScope's default), or choose a scheme now. */
export function ColourStep() {
  const { estimate: e, pricing: p } = useEstimate();
  const reduce = useReducedMotion();
  const b = p.builder;
  if (!b) return null;
  const schemes = b.colours.filter((c) => c.name !== PRE_START);

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Colour option"
        value={e.colourMode}
        onChange={(mode) => chooseColour(mode, mode === "choose" ? e.colour : null)}
        options={[
          { value: "prestart", label: "Pre-start" },
          { value: "choose", label: "Choose colour scheme", disabled: !schemes.length },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        {e.colourMode === "prestart" ? (
          <motion.div
            key="prestart"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }}
          >
            <Note icon={Palette}>
              Colours are chosen with {b.name} at pre-start. Nothing is added to the price now.
            </Note>
          </motion.div>
        ) : (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }}
            className="flex flex-col gap-3"
          >
            <p className="text-xs text-muted-foreground">Select the perfect colour palette for your {b.name} home.</p>
            <ChoiceGrid>
              {schemes.map((c, i) => (
                <ChoiceCard
                  key={c.name}
                  group="colour"
                  index={i}
                  selected={e.colour === c.name}
                  onSelect={() => chooseColour("choose", c.name)}
                  mark={<Palette className="size-4" />}
                  title={c.name.replace(/^"([^"]+)"/, "“$1”")}
                  aside={c.price > 0 ? `+${aud(c.price)}` : <span className="font-normal text-subtle-foreground">Included</span>}
                />
              ))}
            </ChoiceGrid>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A one-line aside inside a step: neutral by default, amber when it warns. */
export function Note({
  children,
  icon: Icon = Info,
  tone = "neutral",
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "caution";
}) {
  return (
    <p
      className={
        tone === "caution"
          ? "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          : "flex items-start gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-muted-foreground dark:bg-white/[0.02]"
      }
    >
      {tone === "caution" ? <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> : <Icon className="mt-px size-3.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}
