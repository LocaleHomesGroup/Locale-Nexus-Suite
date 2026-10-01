import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** AUD with no cents — "$630,000". */
export function aud(n: number, opts: Intl.NumberFormatOptions = {}): string {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    ...opts,
  });
}

/** Two-letter initials from "R. de Thierry" / "Shannan Hart" / "S. and P. Nakamura". */
export function initials(name: string): string {
  const parts = name
    .replace(/\band\b/gi, " ")
    .split(/[\s.]+/)
    .filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

/** Wall-clock stamp used in sync trails — "09:14:03". */
export function clockStamp(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toLocaleTimeString("en-AU", { hour12: false });
}
