"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * Theme (class-based, light default like HRIS), the themed toaster, and a
 * root MotionConfig. `reducedMotion="user"` makes every motion/react animation
 * drop transform/layout travel when the OS asks for reduced motion — a safety
 * net under the per-component `useReducedMotion()` gates (HRIS § 20 D12 is the
 * failure it prevents: an ungated infinite loop). Opacity fades still play.
 *
 * Components must keep `initial` identical on server and client — gate the
 * TRANSITION (`duration: reduce ? 0 : …`), never `initial` itself, or the
 * server HTML and the first client render disagree (hydration mismatch).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="launchpad-theme"
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <ThemedToaster />
    </ThemeProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
    />
  );
}
