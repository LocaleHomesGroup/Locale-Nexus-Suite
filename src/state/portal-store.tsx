"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  PORTAL_TODAY,
  SEED_MESSAGES,
  SEED_UNREAD,
  SEED_UPDATES,
  type BuildUpdate,
  type PortalMessage,
} from "@/data/portal";
import { useLaunchpad } from "./launchpad-store";

/**
 * The portals' shared state: what passes between the Developer portal and
 * the Client portal, and what the client tells Locale. Like the Launchpad
 * store it lives in the dashboard layout, so it survives switching views, and
 * nothing is persisted: a reload resets it to the seed data.
 *
 * Portal writes that reach Locale staff also land in the Launchpad's Inbox
 * (`notify`), so a client's message or a builder's update is never only in
 * the portal.
 */
interface PortalStore {
  /** Builder site updates, newest first. */
  updates: BuildUpdate[];
  /** The builder sends its client a site update: it lands in My build and in their Messages. */
  postUpdate: (u: {
    jobId: number;
    builder: string;
    client: string;
    milestone: string;
    note: string;
    photos: number;
  }) => void;

  /** Every client thread, oldest first. */
  messages: PortalMessage[];
  /** Message ids the client hasn't opened yet. */
  unread: ReadonlySet<string>;
  /** The client sends a message to everyone on their build. */
  sendMessage: (jobId: number, client: string, body: string) => void;
  /** The client opened their Messages. */
  markRead: (jobId: number) => void;

  /** The client let Locale learn from their journey, anonymised, after the 7-year retention period. */
  learnConsent: boolean;
  setLearnConsent: (on: boolean) => void;
}

const Ctx = createContext<PortalStore | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useLaunchpad();
  const [updates, setUpdates] = useState<BuildUpdate[]>(SEED_UPDATES);
  const [messages, setMessages] = useState<PortalMessage[]>(SEED_MESSAGES);
  const [unread, setUnread] = useState<ReadonlySet<string>>(() => new Set(SEED_UNREAD));
  const [learnConsent, setLearnConsent] = useState(false);

  const postUpdate = useCallback<PortalStore["postUpdate"]>(
    ({ jobId, builder, client, milestone, note, photos }) => {
      const stamp = Date.now();
      const id = `u-${jobId}-${stamp}`;
      const msgId = `m-${jobId}-${stamp}`;
      setUpdates((prev) => [{ id, jobId, builder, milestone, note, photos, when: PORTAL_TODAY, fresh: true }, ...prev]);
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          jobId,
          from: "builder",
          name: builder,
          body: `${milestone} update: ${note}${photos ? ` ${photos} photo${photos === 1 ? "" : "s"} in My build.` : ""}`,
          when: PORTAL_TODAY,
        },
      ]);
      setUnread((prev) => new Set(prev).add(msgId));
      notify(`${builder} sent ${client} a ${milestone} update (Developer portal)`);
    },
    [notify],
  );

  const sendMessage = useCallback<PortalStore["sendMessage"]>(
    (jobId, client, body) => {
      const text = body.trim();
      if (!text) return;
      setMessages((prev) => [
        ...prev,
        { id: `m-${jobId}-${Date.now()}`, jobId, from: "you", name: "You", body: text, when: PORTAL_TODAY },
      ]);
      notify(`Message from ${client} (Client portal): “${text.length > 80 ? `${text.slice(0, 77)}…` : text}”`);
    },
    [notify],
  );

  const markRead = useCallback(
    (jobId: number) => {
      setUnread((prev) => {
        const mine = messages.filter((m) => m.jobId === jobId && prev.has(m.id));
        if (!mine.length) return prev;
        const next = new Set(prev);
        mine.forEach((m) => next.delete(m.id));
        return next;
      });
    },
    [messages],
  );

  const value = useMemo<PortalStore>(
    () => ({ updates, postUpdate, messages, unread, sendMessage, markRead, learnConsent, setLearnConsent }),
    [updates, postUpdate, messages, unread, sendMessage, markRead, learnConsent],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortal(): PortalStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortal must be used inside <PortalProvider>");
  return v;
}
