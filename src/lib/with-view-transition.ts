/**
 * Run a theme swap (or any DOM-mutating callback) inside the browser's View
 * Transition so the change cross-fades instead of snapping. Falls back to calling
 * the callback directly where unsupported. Ported from Simple HRIS.
 */
interface ViewTransitionLike {
  ready?: Promise<unknown>;
  finished?: Promise<unknown>;
  updateCallbackDone?: Promise<unknown>;
}
type StartViewTransition = (cb: () => void) => ViewTransitionLike;

export function withViewTransition(cb: () => void): void {
  const start = (document as Document & { startViewTransition?: StartViewTransition })
    .startViewTransition;
  if (typeof start !== "function") {
    cb();
    return;
  }
  try {
    const transition = start.call(document, cb);
    // An interrupted transition rejects these promises; the DOM change still
    // applied, so the rejection is benign.
    transition?.ready?.catch(() => {});
    transition?.finished?.catch(() => {});
    transition?.updateCallbackDone?.catch(() => {});
  } catch {
    cb();
  }
}
