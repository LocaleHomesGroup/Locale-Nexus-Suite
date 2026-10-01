import { cn, initials } from "@/lib/utils";

/**
 * Initials avatar. Tones cycle through the Locale sub-brand tints so a list of
 * people reads as the brand family, not a rainbow. `tone="auto"` picks one from
 * the name so the same person always gets the same colour.
 */
type AvatarTone = "haven" | "nectar" | "skyblue" | "charcoal" | "auto";

const TONES = {
  haven: "bg-haven-300 text-haven-950",
  nectar: "bg-nectar-300 text-nectar-950",
  skyblue: "bg-skyblue-300 text-skyblue-950",
  charcoal: "bg-charcoal text-haven-300 dark:bg-silver dark:text-charcoal",
} as const;

const CYCLE = ["haven", "nectar", "skyblue"] as const;

export function Avatar({
  name,
  tone = "auto",
  size = "md",
  className,
}: {
  name: string;
  tone?: AvatarTone;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const resolved =
    tone === "auto"
      ? CYCLE[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % CYCLE.length]
      : tone;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        TONES[resolved],
        size === "xs" && "size-5 text-[10px]",
        size === "sm" && "size-7 text-xs",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-11 text-sm",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
