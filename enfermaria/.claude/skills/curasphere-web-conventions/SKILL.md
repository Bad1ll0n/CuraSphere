---
name: curasphere-web-conventions
description: Use when writing or reviewing apps/web (Next.js) UI code for CuraSphere — layout spacing, Tailwind usage, next-intl strings, and which reusable components (EmptyState, Skeleton, error/loading boundaries) already exist so they aren't rebuilt ad hoc.
---

# CuraSphere — Web Frontend Conventions

## Spacing / margins

Use inline `style={{ margin: ... }}` / `style={{ padding: ... }}` for precise spacing (margins, gaps between sections), not Tailwind spacing utility classes for these — this is a deliberate, explicitly-stated preference from the app owner: generous breathing room everywhere, nothing flush against corners/edges. Tailwind classes remain fine for color, typography, borders, radius, flex/grid layout — just not for the fine-grained margin/padding values themselves. Look at `apps/web/src/components/empty-state.tsx` for the pattern (`style={{ padding: '48px 24px' }}`, `style={{ marginBottom: '16px' }}`, etc.) already used consistently across the app.

## i18n

All user-facing strings go through `next-intl`'s `useTranslations(namespace)` — see the `curasphere-i18n-audit` skill for namespace structure and the parity-check script. Never inline a literal Portuguese or English string in JSX.

## Reusable components — check before rebuilding

- `components/empty-state.tsx` — `<EmptyState icon="patients|medication|tasks|notes|calendar|search|generic" title=".." description=".." action={{label, onClick}} />` for any "no records" state. Don't hand-roll a new empty-state `<p>` — extend the icon set here instead if a new domain needs one.
- `components/skeleton.tsx` — `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonTable`. Used inside route-level `loading.tsx` files (Next.js App Router streaming loading UI) — every top-level route under `(dashboard)` should have one.
- `error.tsx` at `app/`, `app/(dashboard)/`, and `app/(dashboard)/(clinico)/doentes/[id]/` — App Router error boundaries, each reports to Sentry via `useEffect` and offers a `reset()` retry button. Add a route-scoped `error.tsx` for any new top-level route that does meaningful data fetching, following the same shape (don't rely solely on the global one — a scoped boundary keeps the rest of the shell interactive).
- Skip-to-content link (`className="skip-to-content"`, targets `#main-content`) lives in `client-layout.tsx` — the `<main id="main-content" tabIndex={-1}>` wrapper is already global; new full-page routes don't need to repeat it.

## Accessibility

- Clinical status badges (estável/grave/crítico etc.) must carry an icon/shape signal in addition to color — color alone is not an acceptable status indicator here (colorblind users). Check `patientStatus` i18n namespace and existing badge components for the icon convention before adding a new status value.
- Prefer `getByRole`/accessible-name-based markup — it's both a UX and an e2e-testability property (see `curasphere-e2e-conventions`).

## State ownership

Route-level data fetching is client-side (`'use client'`), not Server Components/Server Actions. For server state specifically, TanStack Query (`useQuery`/`useMutation`) is the dominant, established pattern (~30+ files) — prefer it for new server-state fetching over hand-rolled `useEffect`+`useState` loading/error plumbing. Some older pages still do raw `useEffect`+`fetch`; match the sibling page in the same route group when in doubt, but default to React Query for genuinely new code. Local component state stays `useState`; only reach for anything more global when state is truly shared between unrelated parts of the tree.

## Known accessibility/security gaps (real, not yet fixed — don't repeat, fix opportunistically)

- `components/dark-mode-toggle.tsx` doesn't read `prefers-color-scheme` on first load — always defaults to light regardless of system preference.
- No `prefers-reduced-motion` handling anywhere in the app yet — new animations/transitions should respect it from the start rather than adding to the gap.
- The patient portal (`app/(portal)/portal-auth-context.tsx`) stores its JWT in `localStorage` (`portal_token`), unlike the staff dashboard which correctly uses `httpOnly` cookies verified in `middleware.ts` — an inconsistency, not a pattern to extend. The one existing `dangerouslySetInnerHTML` use (`app/layout.tsx`, a pre-hydration theme-flash-prevention script) is safe because it contains no user input; that's the bar for any future exception, not a precedent for looser use.
