"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

/**
 * The three Locale sub-brand shapes — Financial's Nectar hexagon, Homes' Haven
 * arch, Wealth's Sky Blue tile — composed as in the Launchpad mockup. The
 * Launchpad's equivalent of HRIS's background orbs (§ 14.7): decoration for the
 * highest-traffic landing surface only (Home). Always aria-hidden.
 */
export function BrandShapes({ size = 260, className }: { size?: number; className?: string }) {
  const reduce = useReducedMotion();
  const shapes = [
    {
      d: "M105.849 5.44141C110.544 2.64685 116.392 2.64677 121.088 5.44141L203.677 54.5957C208.19 57.282 210.956 62.1471 210.956 67.3994V166.544C210.956 171.796 208.19 176.66 203.677 179.347L121.088 228.502C116.392 231.296 110.544 231.296 105.849 228.502L23.2598 179.347C18.7464 176.66 15.9805 171.796 15.9805 166.544V67.3994C15.9805 62.1471 18.7464 57.282 23.2598 54.5957L105.849 5.44141Z",
      fill: "#F7D4B7",
    },
    {
      d: "M213.704 335.37L213.704 449.591H412.962L412.962 335.37C413.937 301.821 395.558 234.721 314.247 234.721C232.935 234.721 213.339 301.821 213.704 335.37Z",
      fill: "#9CE3DB",
    },
    {
      d: "M297.731 130.79C305.714 130.79 312.184 137.261 312.185 145.243V318.412H128.896C120.913 318.411 114.442 311.94 114.442 303.958V130.79H297.731Z",
      fill: "#C8D5F5",
    },
  ];
  return (
    <svg
      width={size}
      height={Math.round((size * 451) / 414)}
      viewBox="0 0 414 451"
      fill="none"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
    >
      {shapes.map((s, i) => (
        <motion.path
          key={i}
          d={s.d}
          fill={s.fill}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 1, ease: EASE_OUT, delay: reduce ? 0 : 0.15 + i * 0.12 }}
          style={{ filter: "drop-shadow(4px 7px 10px rgba(50,50,50,0.18))" }}
        />
      ))}
    </svg>
  );
}
