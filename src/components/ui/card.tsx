import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — the bordered content-section panel (HRIS § 6.1 / § 6.2).
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Announcements</CardTitle>
 *       <CardMeta>3 posts</CardMeta>          ← optional, right-aligned
 *     </CardHeader>
 *     <CardContent>…</CardContent>
 *   </Card>
 *
 * `tone="accent"` gives the Haven Green rim used for "needs you" panels
 * (the mockup's My day card). `tone="inverse"` is the charcoal feature card.
 */
type CardTone = "default" | "accent" | "inverse" | "muted";

const TONE: Record<CardTone, string> = {
  default: "border-border bg-card text-card-foreground",
  accent:
    "border-haven-300 bg-gradient-to-br from-haven-50 via-card to-card text-card-foreground dark:border-haven-800 dark:from-haven-950/60 dark:via-card dark:to-card",
  inverse:
    "border-charcoal bg-gradient-to-br from-charcoal to-[#232326] text-silver dark:border-white/10 dark:from-[#26262a] dark:to-[#1a1a1d]",
  // Quieter than default: barely-there fill, so it still reads as secondary.
  muted: "border-border bg-white/40 text-card-foreground dark:bg-transparent",
};

export function Card({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: CardTone }) {
  return (
    <div
      data-slot="card"
      className={cn("relative rounded-xl border shadow-sm", TONE[tone], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4 pb-2", className)}
      {...props}
    />
  );
}

/** Panel title — Libre Baskerville, the brand's heading face. */
export function CardTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Tag
      data-slot="card-title"
      className={cn("font-heading text-[15px] leading-snug font-bold tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("w-full text-xs leading-relaxed text-muted-foreground", className)} {...props} />;
}

/** Right-aligned meta slot in a header row (count, timestamp, action). */
export function CardMeta({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("ml-auto flex items-center gap-2 text-[11px] text-subtle-foreground tabular-nums", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn("px-5 pb-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 rounded-b-xl border-t border-hairline bg-canvas/60 px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A hairline-separated row inside a card body — announcements, list items.
 * The first row in a list gets no top border.
 */
export function CardRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-hairline py-2.5 first:border-t-0", className)} {...props} />;
}
