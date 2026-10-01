import { toast } from "sonner";

/**
 * A write that leaves the Launchpad (Xero, HubSpot, Monday, a builder's inbox)
 * waits out an undo window before it commits, Gmail-style. The row shows its
 * pending state straight away; the toast names exactly what is about to go
 * where, with an Undo; nothing external happens until the window closes.
 *
 *   const cancel = undoable({
 *     message: "Sending INV-D-1042 to Forma",
 *     description: "$17,500 + GST · approves in Xero",
 *     commit: () => approve(id),
 *     undo: () => restore(id),
 *     done: { message: "INV-D-1042 sent to Forma", description: "Approved in Xero" },
 *   });
 *
 * `commit` runs once, after `ms`, unless Undo was pressed (then `undo` runs).
 * The returned function cancels without running either — for unmounts that
 * should drop the write rather than send it.
 */
export interface UndoableOptions {
  /** What is about to happen, present tense: "Sending INV-D-1042 to Forma". */
  message: string;
  description?: string;
  commit: () => void;
  undo?: () => void;
  /** Confirmation shown once the write has gone. */
  done?: { message: string; description?: string };
  /** The undo window. Defaults to 6s. */
  ms?: number;
}

export const UNDO_WINDOW_MS = 6000;

export function undoable({ message, description, commit, undo, done, ms = UNDO_WINDOW_MS }: UndoableOptions) {
  let settled = false;
  const id = toast(message, {
    description: description ? `${description} · ${Math.round(ms / 1000)}s to undo` : `${Math.round(ms / 1000)}s to undo`,
    duration: ms,
    action: {
      label: "Undo",
      onClick: () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        undo?.();
        toast("Undone. Nothing was sent.", { description: message });
      },
    },
  });
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    commit();
    toast.dismiss(id);
    if (done) toast.success(done.message, done.description ? { description: done.description } : undefined);
  }, ms);
  return () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    toast.dismiss(id);
  };
}
