import Link from "next/link";
import { BrandShapes } from "@/components/ui/brand-shapes";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-gradient-to-br from-white via-haven-50/40 to-silver px-6 text-center dark:from-[#111113] dark:via-[#121817] dark:to-[#111113]">
      <BrandShapes size={120} className="opacity-80" />
      <div>
        <p className="text-[10.5px] font-semibold tracking-[0.18em] text-haven-700 uppercase dark:text-haven-300">
          Locale Launchpad
        </p>
        <h1 className="mt-1 font-heading text-2xl font-bold">We couldn&apos;t find that page</h1>
        <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
          The link may be out of date, or the page may not have come across from the prototype.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        Back to Home
      </Link>
    </main>
  );
}
