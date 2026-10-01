
# Locale Launchpad — project rules

- Static Next.js 16 prototype of `Reference/locale-launchpad 1.html`. No backend, auth or RBAC.
- Read `docs/UI-GUIDE.md` before building UI. It maps Simple HRIS's UI standards onto the
  Locale brand; use the components in `src/components/ui/` rather than hand-rolling.
- Shared state is `src/state/launchpad-store.tsx`; shared data is `src/data/`.
- `Reference/` is the client's brand kit and the original mockup — never modify it.
- Verify with `npx tsc --noEmit` and `npx next build`; check light AND dark themes.
