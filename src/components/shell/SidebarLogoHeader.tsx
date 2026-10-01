"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The brand header at the top of the rail — HRIS's SidebarLogoHeader with the
 * Locale master logo.
 *
 * Expanded: the Locale Property Group wordmark in its plate, with the neon
 * hover ring (recoloured to the three sub-brand tints) and one slide-in
 * "heartbeat" ~1s after mount. HRIS repeats it every 12s; the Launchpad plays
 * it once, as an arrival, so nothing in the corner of a working screen keeps
 * moving (UI-GUIDE § 6, "One alarm, and it rests").
 *
 * Collapsed (desktop): the whole plate fades out and the Locale "L" sticker
 * fades + scales in, aligned with the nav icons. The heartbeat runs only while
 * expanded — its forwards-filled animation would otherwise pin the clipped
 * wordmark back to full opacity inside the 64px rail.
 *
 * Both logo colourways are rendered and swapped with `dark:` so there is no
 * theme-dependent hydration flash.
 */
export function SidebarLogoHeader({
  collapsed,
  caption = "Launchpad",
  captionClassName = "text-haven-700 dark:text-haven-300",
}: {
  collapsed: boolean;
  /** Line under the logo — the dashboard you are in. */
  caption?: string;
  captionClassName?: string;
}) {
  const [beat, setBeat] = React.useState(false);

  React.useEffect(() => {
    if (collapsed) return;
    const first = setTimeout(() => setBeat(true), 1000);
    return () => clearTimeout(first);
  }, [collapsed]);

  const beating = beat && !collapsed;

  return (
    <div>
      <div className="relative">
        <Link
          href="/"
          aria-label="Locale Launchpad — Home"
          data-rail-tip="Launchpad home"
          onMouseEnter={() => {
            if (!collapsed && !beat) setBeat(true);
          }}
          className={cn(
            "peer/logo logo-neon block transform-gpu transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none duration-[var(--sb-collapse-ms)] ease-[var(--sb-collapse-ease)] will-change-[opacity]",
            collapsed && "md:pointer-events-none md:opacity-0",
          )}
        >
          <div className="logo-neon__inner overflow-hidden border border-zinc-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-[#1c1c1f]">
            <div
              className={cn("relative h-11 w-full", beating && "logo-heartbeat")}
              onAnimationEnd={() => setBeat(false)}
            >
              {/* object-contain is load-bearing: the wordmark must never be stretched. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/locale-logo-charcoal.svg"
                alt="Locale Property Group"
                className="absolute inset-0 h-full w-full object-contain dark:hidden"
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/locale-logo-silver.svg"
                alt=""
                aria-hidden
                className="absolute inset-0 hidden h-full w-full object-contain dark:block"
                draggable={false}
              />
            </div>
          </div>
        </Link>

        {/* Collapsed: the "L" sticker, lined up with the nav icons and centred on
            the plate. Fades AND scales in after a short delay so the wordmark
            clears first. It also shows the (hidden) logo link's keyboard focus. */}
        <div
          aria-hidden
          className={cn(
            "md:peer-focus-visible/logo:[&>span]:rounded-full md:peer-focus-visible/logo:[&>span]:ring-2 md:peer-focus-visible/logo:[&>span]:ring-ring md:peer-focus-visible/logo:[&>span]:ring-offset-2 md:peer-focus-visible/logo:[&>span]:ring-offset-background",
            "sb-collapse-shift pointer-events-none absolute inset-y-0 left-0 flex origin-left scale-90 transform-gpu items-center opacity-0 transition-[opacity,transform] duration-[var(--sb-collapse-ms)] ease-[var(--sb-collapse-ease)] will-change-[opacity,transform]",
            collapsed &&
              "md:scale-100 md:opacity-100 md:delay-[calc(var(--sb-collapse-ms)/4)] md:duration-[calc(var(--sb-collapse-ms)*3/4)]",
          )}
        >
          <SidebarBrandMark beat={collapsed} />
        </div>
      </div>
      <p
        className={cn(
          "sb-collapse-fade mt-2 truncate px-1 text-center text-[10px] font-semibold tracking-[0.32em] uppercase",
          captionClassName,
        )}
      >
        {caption}
      </p>
    </div>
  );
}

/** The Locale "L" circle sticker — the collapsed rail's brand mark. */
export function SidebarBrandMark({ beat = false, className }: { beat?: boolean; className?: string }) {
  // The beat starts only once the mark has landed (800ms delay in the class),
  // so it never fights the collapse morph.
  const beatClass = beat ? "brand-mark-beating" : undefined;
  return (
    <span className={cn("flex size-9 items-center justify-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/locale-mark-charcoal.svg"
        alt=""
        draggable={false}
        className={cn("size-9 object-contain drop-shadow-sm dark:hidden", beatClass)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/locale-mark-silver.svg"
        alt=""
        draggable={false}
        className={cn("hidden size-9 object-contain drop-shadow-sm dark:block", beatClass)}
      />
    </span>
  );
}
