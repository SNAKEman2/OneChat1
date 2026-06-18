---
name: Phase 1.5 identity layer
description: Theme system, aura rings, and all UI updates from Phase 1.5 implementation
---

## Theme system
- 3 themes: `midnight-void` (default/dark), `slate-dusk` (warm dark), `frost-air` (light)
- Client-side only — stored in `localStorage` key `onechat-theme`
- Hook: `artifacts/onechat/src/hooks/use-theme.ts` exports `useTheme()`, `initTheme()`, `THEMES`, `ThemeId`
- `initTheme()` must be called in `main.tsx` BEFORE React renders to prevent FOUC
- CSS vars live in `artifacts/onechat/src/index.css` under `:root` (midnight-void default) + `[data-theme="slate-dusk"]` + `[data-theme="frost-air"]`
- `--accent: #5865F2` is fixed on `:root`, never overridden by themes

## Aura system
- 5 auras: `calm`, `curious`, `reflective`, `optimistic`, `passionate`
- Server-stored: `aura` text column (nullable) on `profilesTable` in `lib/db`
- Component: `artifacts/onechat/src/components/aura-ring.tsx` exports `AuraRing`, `AuraPicker`, `ThemePickerInline`, `AuraType`, `AURAS`
- `AuraRing` wraps any avatar child; null aura renders a transparent/no-ring fallback
- OpenAPI: `aura` field added to `Profile`, `ProfileSetup`, `ProfileUpdate`, `MatchPartner`, `ArchivedMatch`
- API route: `/matches/today` returns `partner.aura`; `/matches/archive` returns `partnerAura` + `partnerIcebreaker`

## What NOT to call initTheme from
- Do NOT call initTheme inside a component — it must be a module-level side effect in main.tsx so the `data-theme` attribute is set before the first paint.

**Why:** Calling it inside a component causes a brief flash of the default theme before the user's saved theme applies.
