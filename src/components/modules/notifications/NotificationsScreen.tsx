"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, BellOff, Check, CheckCheck, Mail, MessageSquare, MonitorSmartphone, X } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/states";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";

/**
 * Notifications — the mockup's header bell, promoted to an inbox page the way
 * Simple HRIS gives every dashboard a Notifications tab. Anything a module
 * raises with `notify()` lands here; red items need an action.
 */
export function NotificationsScreen() {
  const { notifications, dismissNotification, clearNotifications } = useLaunchpad();
  const reduce = useReducedMotion();
  const urgent = notifications.filter((n) => n.kind === "red").length;

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        description="Everything Launchpad raised for you — sync results, submissions waiting, approvals. Items in red need an action."
        actions={
          notifications.length > 0 ? (
            <Button variant="outline" size="sm" onClick={clearNotifications}>
              <CheckCheck /> Mark all read
            </Button>
          ) : null
        }
      />

      <KpiGrid cols={3}>
        <KpiCard label="Unread" value={notifications.length} icon={MonitorSmartphone} sub="in app" />
        <KpiCard
          label="Need action"
          value={urgent}
          icon={AlertTriangle}
          alert={urgent > 0}
          tone="ok"
          sub={urgent > 0 ? "waiting on you" : "nothing blocked"}
        />
        <KpiCard label="Weekly digest" value="Mon" icon={Mail} sub="next email · 7:00am" />
      </KpiGrid>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
          <CardMeta>{notifications.length} unread</CardMeta>
        </CardHeader>
        <CardContent className="px-0 pb-1">
          {notifications.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="Inbox zero"
              description="New sync results and approvals will appear here the moment they happen."
            />
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {notifications.map((n, i) => (
                  <motion.li
                    key={n.msg + n.when}
                    layout="position"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce) } }}
                    exit={{ opacity: 0, x: -14, transition: { duration: 0.14 } }}
                    className="group flex items-start gap-3 border-t border-hairline px-5 py-3 first:border-t-0"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                        n.kind === "red"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                          : "bg-tone-tint text-tone-ink",
                      )}
                      aria-hidden
                    >
                      {n.kind === "red" ? <AlertTriangle className="size-3.5" /> : <Check className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[13px] leading-snug", n.kind === "red" && "font-semibold text-rose-700 dark:text-rose-300")}>
                        {n.msg}
                      </p>
                      <p className="mt-0.5 text-xs text-subtle-foreground">{n.when}</p>
                    </div>
                    {n.kind === "red" ? (
                      <Pill tone="problem" variant="caps">
                        Action
                      </Pill>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Dismiss notification"
                      onClick={() => dismissNotification(i)}
                      className="opacity-60 group-hover:opacity-100"
                    >
                      <X />
                    </Button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </CardContent>
      </Card>

      <Card tone="muted">
        <CardHeader>
          <CardTitle as="h3">How you get these</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="tone" icon={MonitorSmartphone}>
              In app ✓
            </Pill>
            <Pill tone="tone" icon={Mail}>
              Weekly email ✓
            </Pill>
            <Pill tone="neutral" icon={MessageSquare}>
              SMS · coming
            </Pill>
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">
            Weekly digest by default. Reps can switch to daily for outstanding submission items.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
