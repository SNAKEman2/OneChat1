# OneChat

One conversation per person per day. A minimalist PWA where you get exactly one matched chat partner per 24-hour UTC cycle.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/onechat run dev` — run the frontend (port 19116)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/onechat) — PWA at `/`
- API: Express 5 (artifacts/api-server) — at `/api` and `/ws`
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Auth: Replit Auth (OIDC) via lib/replit-auth-web
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec in lib/api-spec)
- Real-time: WebSocket (ws package) at /ws
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — DB schema (profiles, matches, messages, blocks)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks and Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/websocket.ts` — WebSocket server
- `artifacts/onechat/src/pages/` — React page components
- `artifacts/onechat/src/index.css` — time-driven CSS variable theme
- `artifacts/onechat/src/hooks/` — use-time-of-day, use-websocket

## Architecture decisions

- **One match per day enforced at DB level** — matchesTable has unique indexes on (user1Id, matchDate) and (user2Id, matchDate) so each user gets exactly one match per UTC day.
- **Contract-first API** — OpenAPI spec in lib/api-spec drives codegen for React Query hooks and Zod schemas. Always edit the spec before touching routes.
- **Time-driven color system** — CSS custom properties keyed off `data-time` attribute on `<html>`, set by useTimeOfDay hook. Morning/day/evening/midnight map to warm cream → near-black.
- **WebSocket presence** — /ws endpoint accepts `?matchId=&userId=` params, maintains in-memory client list, broadcasts typing/presence/message events to match rooms.
- **Anti-SaaS design** — No chat bubbles, no cards, no navbars. Cormorant Garamond (messages/names) + Inter (message body) + JetBrains Mono (timestamps/system). Border-radius 0.
- **MatchPartner schema includes userId + lastActive** — the /matches/today response returns the partner's userId (for WS presence lookup) and lastActive timestamp (for inactivity notice). Both are additive fields added to the OpenAPI MatchPartner schema.

## Product

Users sign in via Replit Auth. They get matched with one person per UTC day. They chat in a minimal "room" with a time-remaining line showing how long until the room expires at midnight UTC. After expiry, rooms become read-only "memories" in the gallery. Users can block partners. Profile setup includes display name, icebreaker, and optional avatar URL (supports GIFs). The `/settings` page lets users edit their profile and log out — reachable by tapping their own avatar in the Lounge or Gallery headers.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any change to openapi.yaml — the hooks live in lib/api-client-react/src/generated/.
- Run `pnpm --filter @workspace/db run push` after schema changes — do NOT run in production.
- The lib/replit-auth-web package uses `composite: true` to be properly referenced by artifact tsconfigs.
- The grain texture in index.css uses `opacity` only (no mix-blend-mode) to avoid headless rendering issues.
- matchesTable expires at UTC midnight — `midnightUTC()` helper in matches.ts computes this dynamically.
- JSON body limit is 800kb (raised from 64kb to handle base64 avatar data URLs). If traffic grows significantly, consider moving avatar uploads to object storage instead of passing them as JSON.
- compressImage logic lives in `artifacts/onechat/src/lib/compress-image.ts` and is shared by setup.tsx and settings.tsx. GIFs are passed through uncompressed; other images are cropped square and re-encoded as JPEG at 82% quality, 256×256px.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
