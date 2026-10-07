/**
 * Sections that moved from the Sales Manager dashboard to the Sales Representative portal. An old link
 * to one (a bookmark, a shared URL) lands on the portal's, not on Overview.
 */
const MOVED_TO_PORTAL: Record<string, string> = {
  week: "/consultant?tab=week",
  submissions: "/consultant?tab=submissions",
};

export function portalHrefFor(tab: string | null): string | null {
  return tab !== null && Object.hasOwn(MOVED_TO_PORTAL, tab) ? MOVED_TO_PORTAL[tab] : null;
}
