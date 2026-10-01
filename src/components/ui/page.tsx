import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Page chrome for a module screen.
 *
 *   <PageContainer>
 *     <PageHeader eyebrow="Operations" title="CRM Dash Sync" description="…" actions={<Button/>} />
 *     …sections, gap-6 apart…
 *   </PageContainer>
 *
 * Full width, like every HRIS dashboard: content runs edge to edge inside the
 * gutters — no centred max-width column. Tables and panels span the page;
 * only running text caps its own line length (PageHeader's description).
 *
 * The heading follows HRIS's shipped "work-surface heading" (§ 3.2.2 As shipped)
 * — no gradient hero — set in Libre Baskerville Bold per the Locale stylesheet.
 */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex w-full min-w-0 flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 lg:px-8 lg:pt-8", className)}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10.5px] font-semibold tracking-[0.18em] text-haven-700 uppercase dark:text-haven-300">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-xl font-bold tracking-tight text-balance sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A tiny-caps section label with an optional right-side slot (HRIS § 9.1 form section header). */
export function SectionLabel({
  children,
  right,
  icon: Icon,
  className,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 border-b border-hairline pb-1.5", className)}>
      {Icon ? <Icon className="size-3.5 text-subtle-foreground" aria-hidden /> : null}
      <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{children}</p>
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}
