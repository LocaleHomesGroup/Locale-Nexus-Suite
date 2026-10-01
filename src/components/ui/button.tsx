import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — Simple HRIS variants and sizes (ui-standards § 7), Locale colours.
 *
 * default     Primary affirmative. Charcoal with Haven Green ink (dark: inverted).
 * brand       The Haven Green CTA — "send / sync / approve" moments. Use sparingly,
 *             like HRIS's emerald "money in flight" button.
 * outline     Secondary action (Cancel, Edit, header utilities).
 * secondary   Tertiary, rare.
 * ghost       Inline icon buttons, overflow, sign-out.
 * destructive Delete / Reject / Discard — tinted, never solid red.
 * link        Inline "View all →" links inside cards.
 */
export const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap outline-none select-none transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 focus-visible:ring-3 focus-visible:ring-ring/45 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        brand:
          "bg-tone-fill text-tone-on-fill shadow-sm shadow-black/10 hover:brightness-[1.04] active:brightness-95",
        outline:
          "border-border bg-card text-foreground shadow-xs hover:border-tone-line hover:bg-tone-soft/70 dark:bg-white/[0.03] dark:hover:bg-tone-soft",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-300/50 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25",
        link: "h-auto px-0 text-tone-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-md px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 px-4",
        icon: "size-8",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-md",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
