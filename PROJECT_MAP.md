# OneChat — Project Map

> Generated: 2026-06-15  
> Stack: pnpm monorepo · Node.js 24 · TypeScript 5.9 · React + Vite · Express 5 · PostgreSQL + Drizzle ORM

---

## 1. Full Directory Tree

```
onechat/
├── artifacts/
│   ├── api-server/                  Express 5 backend application
│   │   ├── build.mjs                Custom esbuild bundle script
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts             Server entry point (binds HTTP + WS)
│   │       ├── app.ts               Express app factory (CORS, body parsing, middleware)
│   │       ├── lib/
│   │       │   ├── auth.ts          Replit OIDC session helpers
│   │       │   ├── logger.ts        Pino logger singleton
│   │       │   └── websocket.ts     WebSocket server + ignition ritual logic
│   │       ├── middlewares/
│   │       │   └── authMiddleware.ts  Express-session + Replit OIDC deserialization
│   │       └── routes/
│   │           ├── index.ts         Root router aggregating all sub-routers
│   │           ├── auth.ts          /login /callback /logout /auth/user /mobile-auth/*
│   │           ├── health.ts        GET /healthz
│   │           ├── matches.ts       GET /matches/today  POST /matches/:id/end
│   │           ├── messages.ts      GET/POST /matches/:id/messages
│   │           └── profiles.ts      GET/PATCH /profiles/me  POST /profiles/setup
│   │
│   ├── onechat/                     React + Vite PWA (main user-facing app)
│   │   ├── index.html               HTML entry point (mounts #root)
│   │   ├── vite.config.ts           Vite config: BASE_URL, path aliases, PWA plugin
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── public/
│   │   │   ├── favicon.ico
│   │   │   ├── manifest.json        PWA web app manifest
│   │   │   └── robots.txt
│   │   └── src/
│   │       ├── main.tsx             createRoot entry
│   │       ├── App.tsx              QueryClient, routing (wouter), AnimatePresence
│   │       ├── index.css            Global CSS: Discord-dark theme vars + Tailwind
│   │       ├── components/
│   │       │   ├── ignition.tsx     Room Ignition Ritual UI component
│   │       │   └── ui/              Shadcn/UI primitive components (40+ files)
│   │       ├── hooks/
│   │       │   ├── use-mobile.tsx   Viewport mobile breakpoint hook
│   │       │   ├── use-time-of-day.ts  (legacy, no longer drives theme)
│   │       │   ├── use-toast.ts     Toast notification hook
│   │       │   └── use-websocket.ts WebSocket hook (messages, typing, ignition)
│   │       ├── lib/
│   │       │   ├── query-keys.ts    TanStack Query key factories
│   │       │   └── utils.ts         cn() tailwind-merge helper
│   │       └── pages/
│   │           ├── splash.tsx       Landing / sign-in screen
│   │           ├── setup.tsx        First-time profile setup (name, icebreaker, avatar)
│   │           ├── room.tsx         Main chat room (Lounge / Ignition / Active / Ended)
│   │           ├── gallery.tsx      Archive conversation list ("Memories")
│   │           ├── frozen-room.tsx  Read-only view of past conversation
│   │           └── not-found.tsx    404 page
│   │
│   └── mockup-sandbox/              Isolated Vite dev server for UI prototyping (canvas)
│
├── lib/
│   ├── db/                          PostgreSQL + Drizzle ORM library
│   │   ├── drizzle.config.ts        Drizzle-kit config (points to DATABASE_URL)
│   │   └── src/
│   │       ├── index.ts             Re-exports: db client + all schema tables
│   │       └── schema/
│   │           ├── auth.ts          Session storage table (express-session + pg)
│   │           ├── profiles.ts      User profiles table
│   │           ├── matches.ts       Daily match pairs table (unique index enforces 1/day)
│   │           ├── messages.ts      Chat messages table (with replyToId)
│   │           └── blocks.ts        User block pairs table
│   │
│   ├── api-spec/                    Contract-first OpenAPI source of truth
│   │   ├── openapi.yaml             Full OpenAPI 3.1 spec (all paths + schemas)
│   │   └── orval.config.ts          Orval codegen: React Query hooks + Zod schemas
│   │
│   ├── api-client-react/            Generated React Query client (do not hand-edit)
│   │   └── src/
│   │       ├── index.ts             Barrel export
│   │       ├── custom-fetch.ts      Fetch wrapper (auth token, base URL, error types)
│   │       └── generated/
│   │           ├── api.ts           All React Query hooks (useGetTodayMatch, etc.)
│   │           └── api.schemas.ts   Zod schemas for every API model
│   │
│   ├── api-zod/                     Standalone Zod schemas (generated, separate package)
│   │   └── src/generated/types/     One file per schema (profile.ts, message.ts, etc.)
│   │
│   └── replit-auth-web/             Replit OIDC auth for React apps
│       └── src/
│           ├── index.ts             Exports AuthProvider + useAuth
│           └── use-auth.ts          React hook: isAuthenticated, user, login(), logout()
│
├── scripts/
│   ├── package.json
│   ├── post-merge.sh                Runs after task-agent merges (installs deps, migrations)
│   └── src/hello.ts                 Placeholder utility script
│
├── package.json                     Root: workspace scripts (typecheck, build, dev)
├── pnpm-workspace.yaml              Workspace glob patterns + catalog dependency pins
├── pnpm-lock.yaml                   Lockfile (committed, reproducible installs)
├── tsconfig.base.json               Shared strict TS defaults (all libs extend this)
├── tsconfig.json                    Solution file: references all composite libs
├── replit.md                        Project README + user preferences
├── ONECHAT_DOCS.md                  Full product + technical documentation
└── PROJECT_MAP.md                   ← this file
```

---

## 2. Major Folder Descriptions

| Folder | Purpose |
|--------|---------|
| `artifacts/api-server` | Express 5 API backend. Handles auth, matches, messages, profiles. Serves `/api/*` and `/ws`. Built with esbuild to CJS for Node. |
| `artifacts/onechat` | React + Vite PWA. The entire user-facing chat application. Served at `/`. |
| `artifacts/mockup-sandbox` | Isolated Vite instance for iterating on UI components on the Replit canvas board. Not a production artifact. |
| `lib/db` | Drizzle ORM schema + client. The single source of truth for DB table shapes. `pnpm --filter @workspace/db run push` applies dev migrations. |
| `lib/api-spec` | OpenAPI 3.1 YAML and the Orval config that generates code from it. Editing this file is the first step for any API change. |
| `lib/api-client-react` | Auto-generated TanStack Query hooks and Zod validators. Never hand-edit. Regenerate with `pnpm --filter @workspace/api-spec run codegen`. |
| `lib/api-zod` | Secondary codegen output: standalone Zod schemas consumed by the API server for request validation. |
| `lib/replit-auth-web` | Thin React wrapper around the Replit OIDC session endpoint. Provides `useAuth()` hook. Has `composite: true` so artifact tsconfigs can reference it. |
| `scripts` | Utility scripts. `post-merge.sh` is wired into the Replit task-agent merge pipeline. |

---

## 3. Major File Descriptions

### Root
| File | Description |
|------|-------------|
| `package.json` | Defines `typecheck`, `typecheck:libs`, and `build` workspace-level scripts. No `dev` script — apps run via Replit workflows. |
| `pnpm-workspace.yaml` | Lists workspace globs, catalog dependency version pins, and `overrides`. |
| `tsconfig.base.json` | Strict TypeScript defaults: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`. All lib tsconfigs extend this. |
| `tsconfig.json` | Solution-level config. References only the composite `lib/*` packages. Artifact packages are not listed here. |
| `replit.md` | Human-readable project overview, run commands, stack notes, architecture decisions, and user preferences. |

### Backend (`artifacts/api-server/src/`)
| File | Description |
|------|-------------|
| `index.ts` | Reads `PORT` env var, creates HTTP server, calls `setupWebSocket()`, starts listening. |
| `app.ts` | Constructs Express app: pino-http logging, CORS (locked to `REPLIT_DOMAINS` in prod), cookie-parser, 64kb body limit, auth middleware, mounts `/api` router. |
| `lib/auth.ts` | Configures `express-session` with `connect-pg-simple` (sessions stored in DB), Replit OIDC passport strategy, `req.isAuthenticated()`, `req.user`. |
| `lib/logger.ts` | Pino logger singleton. All route handlers use `req.log`; non-request code uses this import. |
| `lib/websocket.ts` | `WebSocketServer` at path `/ws`. Maintains in-memory `clients[]`. Handles: `typing` (relay to partner), `ignition_tap` (record timestamp, resolve when both tap or 12s timer fires), `presence` (broadcast on connect/disconnect). Exports `broadcastToMatch()` used by the messages route. |
| `middlewares/authMiddleware.ts` | Deserializes session on every request. Attaches `req.user` if authenticated. |
| `routes/auth.ts` | OIDC: GET /login (redirect to Replit), GET /callback (exchange code, create session), GET /logout, GET /auth/user (session status), POST /mobile-auth/token-exchange. |
| `routes/matches.ts` | GET /matches/today — finds or creates today's match (pairs waiting users). POST /matches/:id/end — marks match ended or blocked. GET /matches/archive — returns all past matches with partner info + first message. |
| `routes/messages.ts` | GET /matches/:id/messages — returns all messages ordered by time. POST /matches/:id/messages — validates content + optional replyToId, inserts, broadcasts via WebSocket. |
| `routes/profiles.ts` | GET /profiles/me, PATCH /profiles/me, POST /profiles/setup. Accepts `avatarUrl` as a data URL (base64) or https URL up to 400KB. |

### Frontend (`artifacts/onechat/src/`)
| File | Description |
|------|-------------|
| `main.tsx` | `createRoot` entry. Imports global CSS. |
| `App.tsx` | Sets up `QueryClient`, `WouterRouter` (base = `BASE_URL`), `AnimatePresence` page transitions, and top-level route table. Calls `useTimeOfDay()` (legacy, kept but no longer drives visual theme). |
| `index.css` | Single static Discord-dark theme defined in `:root` CSS custom properties. Tailwind v4 `@theme inline` block maps vars to color tokens. No time-driven variants. Also defines `.reply-quote` utility class. |
| `pages/splash.tsx` | App icon + name + tagline. "Sign in with Replit" button. Redirects authenticated users to `/room` or `/setup`. |
| `pages/setup.tsx` | First-run profile form. File picker compresses images to 256×256 JPEG via canvas; GIFs pass through as-is. Sends avatar as base64 data URL. |
| `pages/room.tsx` | The main chat page. Four sub-states: `Lounge` (waiting for match), `Ignition` (ritual), `ActiveRoom` (live Discord-style chat), `EndedRoom`. ActiveRoom features: both-sides Discord layout, message grouping, reply-to, slide-up input, icebreaker status banner, typing indicator, room expiry timer. |
| `pages/gallery.tsx` | Conversation list ("Memories") — avatar, partner name, first-message preview, date. |
| `pages/frozen-room.tsx` | Read-only Discord-style view of an archived conversation. Grayscale + brightness filter applied. |
| `components/ignition.tsx` | The "Room Ignition Ritual" — a 12-second timed experience where both users tap to signal presence, resolving who speaks first. Uses WebSocket `ignition_tap` events. |
| `hooks/use-websocket.ts` | Manages a single WebSocket connection per match. Handles reconnect on close. Exposes: `messages`, `partnerTyping`, `onlineStatus`, `sendTyping()`, `ignitionResult`, `tapIgnition()`. |
| `lib/query-keys.ts` | Centralised TanStack Query key factories so cache invalidation is consistent. |

---

## 4. Frontend Architecture

```
React (Vite + TypeScript)
│
├── Routing: wouter (lightweight, hash-free, base-path aware)
│     /           → Splash
│     /setup      → Setup
│     /room       → Room (main app)
│     /gallery    → Gallery
│     /gallery/:id → FrozenRoom
│
├── State management: TanStack Query v5
│     All server state goes through generated hooks in @workspace/api-client-react.
│     Optimistic updates are NOT used — mutations invalidate queries after success.
│
├── Real-time: useWebsocket hook
│     Single WebSocket connection opened when ActiveRoom mounts.
│     Inbound events update local React state directly (no Redux/Zustand).
│     Reconnects automatically on close (2s delay).
│
├── Styling: Tailwind CSS v4 + CSS custom properties
│     Theme is a single static Discord-dark palette defined in :root.
│     No runtime theme switching.
│     Fonts: Cormorant Garamond (messages/names) + JetBrains Mono (UI chrome).
│
├── Animations: Framer Motion
│     Page transitions: opacity + y slide (AnimatePresence mode="wait").
│     Message entrance: opacity + y + scale.
│     Typing dots: looping opacity/translate.
│
└── Build: Vite
      Output: /dist (static files)
      Path alias: @/ → src/
      BASE_URL: injected by Replit workflow as env var
```

---

## 5. Backend Architecture

```
Express 5 (TypeScript → esbuild CJS bundle)
│
├── HTTP server (Node.js `http.createServer`)
│     Listens on process.env.PORT
│     Mounted at base path /api/*
│
├── WebSocket server (ws package)
│     Path: /ws
│     Query params required: ?matchId=&userId=
│     In-memory client registry (lost on server restart — presence is ephemeral)
│
├── Middleware stack (in order)
│     pino-http          → structured request logging
│     cors               → locked to REPLIT_DOMAINS in prod, open in dev
│     cookie-parser      → parses session cookie
│     express.json       → 64kb body limit
│     authMiddleware     → deserializes session, attaches req.user
│
├── Route modules
│     /api/healthz           → health
│     /api/auth/*            → OIDC login/callback/logout + session check
│     /api/profiles/*        → profile CRUD
│     /api/matches/*         → match lifecycle + archive
│     /api/matches/:id/messages → message CRUD
│
├── Auth: Replit OIDC (OpenID Connect with PKCE)
│     Provider: https://replit.com/oidc
│     Sessions: stored in PostgreSQL via connect-pg-simple
│     Session secret: SESSION_SECRET env var
│
└── Logging: Pino
      req.log in route handlers
      logger singleton for non-request code (websocket, etc.)
      Never console.log in server code
```

---

## 6. Database Schema Overview

All tables use PostgreSQL via Drizzle ORM. Connection string: `DATABASE_URL` env var.

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| user_id | text UNIQUE | Replit user ID (from OIDC sub claim) |
| display_name | text | max 50 chars (validated in route) |
| avatar_url | text nullable | https URL or base64 data URL (up to ~400KB) |
| icebreaker | text | max 280 chars |
| last_active | timestamptz | updated on profile patch |
| created_at | timestamptz | |

### `matches`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_1_id | text | Replit user ID |
| user_2_id | text | Replit user ID |
| match_date | date | UTC date string `YYYY-MM-DD` |
| status | text | `active` \| `ended_by_user_1` \| `ended_by_user_2` \| `blocked` |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-updated on change |

**Unique indexes**: `(user_1_id, match_date)` and `(user_2_id, match_date)` — DB-enforced 1 match per user per UTC day.

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| match_id | uuid | FK to matches (not enforced at ORM level) |
| sender_id | text | Replit user ID |
| content | text | max 2000 chars (validated in route) |
| reply_to_id | uuid nullable | ID of message being replied to |
| created_at | timestamptz | |

### `blocks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| blocker_id | text | Replit user ID |
| blocked_id | text | Replit user ID |
| created_at | timestamptz | |

**Unique index**: `(blocker_id, blocked_id)` — prevents duplicate blocks.

### `sessions` (managed by connect-pg-simple)
Standard `express-session` table: `sid`, `sess` (JSON), `expire`.

---

## 7. Authentication Flow

```
Browser                         API Server                    Replit OIDC
  │                                │                               │
  │── GET /api/login ──────────────►│                               │
  │                         generate PKCE code_verifier + state    │
  │                         store in session                        │
  │◄── 302 → Replit /authorize ────│                               │
  │                                                                 │
  │──────────────────── GET /authorize?... ────────────────────────►│
  │◄──────────────── 302 → /api/callback?code=&state= ─────────────│
  │                                │                               │
  │── GET /api/callback ───────────►│                               │
  │                         verify state, exchange code ──────────►│
  │                         ◄── id_token + access_token ───────────│
  │                         verify JWT, extract sub (userId)        │
  │                         create/update session in DB             │
  │◄── 302 → / (or returnTo) ──────│                               │
  │                                │                               │
  │── subsequent requests ─────────►│                               │
  │   (session cookie attached)    │                               │
  │                         authMiddleware deserializes session     │
  │                         req.user = { id, username, ... }       │
```

**Frontend**: `useAuth()` hook calls `GET /api/auth/user` on mount. Returns `{ isAuthenticated, user, login(), logout() }`. `login()` navigates to `/api/login`. Splash page triggers `login()` on button tap.

---

## 8. Message Flow

### Sending a message

```
User types → input onChange → sendTyping(true) via WS
User taps send →
  POST /api/matches/:id/messages { content, replyToId? }
    → Zod validation (min 1, max 2000 chars)
    → match existence + ownership check
    → match status === "active" check
    → match date ≥ today check
    → INSERT into messages
    → broadcastToMatch(matchId, { type: "message", data: serialized })
  ← 201 { id, matchId, senderId, content, replyToId, createdAt }

Recipient's useWebsocket receives { type: "message", data }
  → setMessages(prev => [...prev, data])   (deduped by id)
  → setPartnerTyping(false)
```

### Receiving typing indicator

```
Sender types → WS send { type: "typing", isTyping: true }
Server relays to all OTHER clients in same matchId
Recipient useWebsocket → setPartnerTyping(true)
  → auto-clears after 3s timeout
```

### Reply threading

```
User long-taps message → setReplyTo({ id, content, senderName })
Input opens with reply banner showing quote
User sends → POST includes { replyToId: <original message uuid> }
Messages with replyToId render a .reply-quote block above the content
Quote looked up from in-memory msgMap (Map<id, Message>)
```

---

## 9. Media Handling Flow

### Avatar upload (profile setup / edit)

```
User taps avatar circle → hidden <input type="file" accept="image/*,image/gif"> opens

For JPEG/PNG/WebP:
  FileReader → HTMLImageElement → canvas.drawImage (crop to square, 256×256)
  → canvas.toDataURL("image/jpeg", 0.82)
  → ~15–25KB → ~20–33KB base64 string

For GIF:
  FileReader.readAsDataURL(file) → raw base64 (no resampling, animated frames preserved)

POST /api/profiles/setup or PATCH /api/profiles/me
  body: { avatarUrl: "data:image/jpeg;base64,..." }
  Server: Zod max(400_000 chars) validation
  → stored in profiles.avatar_url (PostgreSQL text column, unlimited)

Avatar rendered:
  <img src={avatarUrl} ... />
  Works for both https:// URLs and data: URLs natively in the browser
```

> **Limitation**: base64 data URLs for GIFs can be large (100KB+). No server-side processing, resizing, or CDN delivery. Suitable for development; production should use object storage.

---

## 10. Known Limitations and Technical Debt

### High Priority

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **WebSocket state is in-memory** | `lib/websocket.ts` | On server restart, all presence and ignition state is lost. Cannot scale horizontally. Use Redis pub/sub for production. |
| 2 | **Avatar base64 in DB** | `profiles.avatar_url` | GIF avatars can be several hundred KB stored as text in PostgreSQL. Impacts query performance at scale. Migrate to object storage (S3/R2). |
| 3 | **No DB foreign keys** | `lib/db/schema/messages.ts` | `match_id` and `reply_to_id` have no enforced FK constraints. Orphaned rows possible if matches are deleted. |
| 4 | **Match pairing is naive** | `routes/matches.ts` | Finds any unmatched user for today. No deduplication preference, no mutual-block check at pairing time (only blocks applied reactively). |
| 5 | **Sessions never expire** | `lib/auth.ts` | `connect-pg-simple` sessions have no `ttl` configured. The `sessions` table will grow unbounded. Add `maxAge` and periodic cleanup. |

### Medium Priority

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | **`useTimeOfDay` still imported in App.tsx** | `App.tsx:6,52` | The hook still sets a `data-time` HTML attribute that has no effect (theme was simplified). Dead code, minor. |
| 7 | **No rate limiting** | `routes/messages.ts` | A user can POST messages as fast as the network allows. Add express-rate-limit or similar. |
| 8 | **No message pagination** | `routes/messages.ts` | All messages for a match returned in a single query. Rooms with thousands of messages would be slow. |
| 9 | **WS auth is honour-system** | `lib/websocket.ts` | The WebSocket connection takes `userId` as a query param. It should verify the session cookie against the DB instead. |
| 10 | **Reply quote lookup is client-only** | `pages/room.tsx` | `msgMap` is built from in-memory messages array. If the replied-to message isn't loaded yet (future pagination), the quote won't render. |

### Low Priority / Future Work

| # | Issue |
|---|-------|
| 11 | No push notifications (PWA `PushManager` not implemented). |
| 12 | No image/link previews inside messages. |
| 13 | No way to edit or delete a sent message. |
| 14 | `scripts/src/hello.ts` is a placeholder; scripts package has no real utilities yet. |
| 15 | Orval-generated hooks include unused endpoints from the OpenAPI spec (e.g. mobile auth endpoints unused by the web app). |
| 16 | `lib/api-zod` and `lib/api-client-react/src/generated/api.schemas.ts` duplicate Zod schema definitions; could be unified. |
| 17 | No test suite (unit, integration, or e2e). |
