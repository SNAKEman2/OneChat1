# OneChat — Complete Project Documentation

> One conversation per person per day. A minimalist PWA where you get exactly one matched chat partner per 24-hour UTC cycle.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [WebSocket Protocol](#7-websocket-protocol)
8. [Room Ignition Ritual System](#8-room-ignition-ritual-system)
9. [Design System](#9-design-system)
10. [Authentication](#10-authentication)
11. [Running Locally](#11-running-locally)
12. [Environment Variables](#12-environment-variables)
13. [Deployment](#13-deployment)
14. [Security Model](#14-security-model)
15. [Known Limitations & Future Work](#15-known-limitations--future-work)

---

## 1. Product Overview

OneChat is a minimalist progressive web app (PWA) built around a single constraint: **each user gets exactly one matched conversation partner per UTC day.**

### Core Loop

1. User signs in via Replit Auth (Google / GitHub / Replit account).
2. User creates a profile: display name, icebreaker, optional avatar URL.
3. At any point during the day, the app tries to match them with another active user.
4. If a match is found, both users pass through a **10–15 second Ignition Ritual** before the room opens.
5. They chat in a minimal, undecorated room until midnight UTC.
6. At midnight the room locks — no new messages. It becomes a read-only "Memory."
7. Past rooms live in the **Gallery** — a personal archive of all past conversations.
8. Either user can end a room early or block their partner.

### Design Philosophy

Anti-SaaS. The entire interface is inspired by paper and ink:
- No chat bubbles, no cards, no navigation bars
- No colored backgrounds, no glassmorphism, no drop shadows
- Two fonts only: **Cormorant Garamond** (messages, names) + **JetBrains Mono** (timestamps, system text, labels)
- Border-radius: 0 everywhere
- Color driven by the time of day — the room literally changes tone as the day passes

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 (strict) |
| Frontend | React 19 + Vite |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Replit Auth (OpenID Connect / PKCE) |
| Real-time | WebSocket (`ws` package) |
| Validation | Zod v4 |
| API contracts | OpenAPI 3.0 → Orval codegen |
| Animation | Framer Motion |
| Routing | Wouter |
| Styling | Tailwind CSS v4 |
| Build | esbuild (server), Vite (client) |

---

## 3. Architecture

```
Browser
  │
  ├─ HTTPS → / (Vite PWA)          — served by Vite dev server / static at /
  ├─ HTTPS → /api/* (REST)         — Express 5 API server at port 8080
  └─ WSS   → /ws  (WebSocket)      — ws server on same port 8080
```

A shared **reverse proxy** routes by path — `/api` and `/ws` to the API server, everything else to the Vite frontend. In production (deployed on Replit) the proxy adds TLS automatically.

### Request Flow

```
User opens app
  → useAuth() fetches /api/auth/user
  → if null → Splash page → /api/login → Replit OIDC → /api/auth/callback → session cookie
  → if no profile → /setup page → POST /api/profiles/setup
  → Room page → GET /api/matches/today (polls every 10s while waiting)
  → when active match found → WebSocket opens at /ws?matchId=&userId=
  → Ignition ritual (10–15s, coordinated via WS)
  → Chat opens → POST /api/matches/:id/messages (persists) + WS broadcast (real-time)
  → midnight UTC → room locks → Gallery
```

---

## 4. Project Structure

```
workspace/
├── artifacts/
│   ├── api-server/           # Express API + WebSocket (@workspace/api-server)
│   │   └── src/
│   │       ├── app.ts        # Express setup, CORS, middleware
│   │       ├── index.ts      # HTTP server entry point
│   │       ├── routes/
│   │       │   ├── auth.ts       # Replit OIDC login/callback/logout/user
│   │       │   ├── matches.ts    # Matchmaking, today's match, archive
│   │       │   ├── messages.ts   # Send & retrieve messages
│   │       │   ├── profiles.ts   # Profile setup, get, update
│   │       │   └── health.ts     # GET /api/healthz
│   │       ├── lib/
│   │       │   ├── auth.ts       # OIDC client setup (openid-client)
│   │       │   ├── logger.ts     # Pino logger singleton
│   │       │   └── websocket.ts  # WS server + ignition room tracker
│   │       └── middlewares/
│   │           └── authMiddleware.ts  # Session + passport setup
│   │
│   └── onechat/              # React PWA (@workspace/onechat)
│       └── src/
│           ├── pages/
│           │   ├── splash.tsx        # Landing / auth gate
│           │   ├── setup.tsx         # Profile creation
│           │   ├── room.tsx          # Today's chat room (Lounge / Active / Ended)
│           │   ├── gallery.tsx       # Archive of past conversations
│           │   ├── settings.tsx      # Edit profile + log out (/settings)
│           │   └── frozen-room.tsx   # Read-only past conversation
│           ├── components/
│           │   └── ignition.tsx      # Room Ignition Ritual component
│           ├── hooks/
│           │   ├── use-websocket.ts  # WS client hook (messages, typing, presence, ignition)
│           │   └── use-time-of-day.ts # UTC time → CSS theme attribute
│           ├── lib/
│           │   ├── query-keys.ts     # React Query key factories
│           │   └── compress-image.ts # Client-side image compression (shared by setup + settings)
│           ├── index.css             # Design system, time-driven CSS vars
│           └── main.tsx              # React root, router
│
├── lib/
│   ├── db/                   # PostgreSQL + Drizzle (@workspace/db)
│   │   └── src/
│   │       ├── index.ts      # DB client + all table exports
│   │       └── schema/       # Drizzle table definitions
│   │           ├── profiles.ts
│   │           ├── matches.ts
│   │           ├── messages.ts
│   │           └── blocks.ts
│   ├── api-spec/             # OpenAPI 3.0 spec + codegen (@workspace/api-spec)
│   │   └── openapi.yaml
│   ├── api-client-react/     # Generated React Query hooks + Zod schemas
│   │   └── src/generated/
│   └── replit-auth-web/      # useAuth() hook (@workspace/replit-auth-web)
│
└── scripts/                  # Utility scripts (@workspace/scripts)
```

---

## 5. Database Schema

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto |
| `userId` | text UNIQUE | Replit user ID |
| `displayName` | text | max 50 chars (validated) |
| `icebreaker` | text | max 280 chars (validated) |
| `avatarUrl` | text nullable | must be valid URL if provided |
| `lastActive` | timestamp | updated on every `/matches/today` call |
| `createdAt` | timestamp | auto |

### `matches`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto |
| `user1Id` | text | Replit user ID |
| `user2Id` | text | Replit user ID |
| `matchDate` | text | `YYYY-MM-DD` UTC |
| `status` | enum | `active`, `ended_by_user_1`, `ended_by_user_2`, `blocked` |
| `createdAt` | timestamp | auto |

**Unique indexes**: `(user1Id, matchDate)` and `(user2Id, matchDate)` — enforces one match per user per UTC day at the database level, not just in application code. Race conditions are impossible.

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto |
| `matchId` | uuid FK | references matches |
| `senderId` | text | Replit user ID |
| `content` | text | max 2000 chars (validated) |
| `createdAt` | timestamp | auto |

### `blocks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto |
| `blockerId` | text | who blocked |
| `blockedId` | text | who was blocked |
| `createdAt` | timestamp | auto |

**Unique index**: `(blockerId, blockedId)` — no duplicate blocks.

---

## 6. API Reference

All endpoints are under `/api`. All require authentication (401 if not signed in) except the auth routes.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/login` | Initiates Replit OIDC login. Redirects to Replit. |
| `GET` | `/api/auth/callback` | OIDC callback. Sets session cookie. Redirects to `/`. |
| `GET` | `/api/logout` | Destroys session. Redirects to `/`. |
| `GET` | `/api/auth/user` | Returns `{ user: { id, name, email, profileImage } }` or `{ user: null }`. |

### Profiles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/profiles/me` | ✓ | Returns your profile or 404. |
| `POST` | `/api/profiles/setup` | ✓ | Creates your profile. 409 if already exists. |
| `PATCH` | `/api/profiles/me` | ✓ | Updates display name, icebreaker, and/or avatarUrl. |

**Profile validation:**
- `displayName`: 1–50 characters, trimmed
- `icebreaker`: 1–280 characters, trimmed
- `avatarUrl`: valid URL, max 500 characters, nullable

### Matches

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/matches/today` | ✓ | Get or create today's match. Status: `no_profile`, `waiting`, `active`, `ended`, `blocked`. |
| `POST` | `/api/matches/:matchId/end` | ✓ | End or block a match. Body: `{ "block": true/false }`. |
| `GET` | `/api/matches/archive` | ✓ | Returns past matches (up to 100), ordered newest first. |

**Matchmaking logic** (in `/matches/today`):
1. Check for existing match today → return it if found
2. Find candidates: other users with `lastActive` within 24h, not already matched today, not blocked by/blocking you
3. Pick randomly from up to 10 candidates
4. Insert match row (DB unique constraint prevents duplicates)

**MatchPartner object** (returned in active/ended match state):
```json
{
  "userId": "string",        // partner's Replit user ID — used for WS presence lookup
  "displayName": "string",
  "avatarUrl": "string|null",
  "icebreaker": "string",
  "lastActive": "string"     // ISO datetime — used for inactivity notice (>3h offline)
}
```

### Messages

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/matches/:matchId/messages` | ✓ | Returns all messages for a match. 403 if not a participant. |
| `POST` | `/api/matches/:matchId/messages` | ✓ | Sends a message. Broadcasts via WS. |

**Message validation:** content must be 1–2000 characters.  
**Expiry check:** messages are rejected if `matchDate < today` UTC (room has expired).

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/healthz` | Returns `{ ok: true }`. Used by deployment health checks. |

---

## 7. WebSocket Protocol

**Connection URL:** `wss://your-domain/ws?matchId=<uuid>&userId=<string>`

Both `matchId` and `userId` are required. Connection is rejected (1008) if either is missing.

### Client → Server Messages

```jsonc
// Signal readiness / interest (anonymous — no obligation)
{ "type": "ignition_tap" }

// Typing status
{ "type": "typing", "isTyping": true }
```

### Server → Client Messages

```jsonc
// When a user connects or disconnects
{ "type": "presence", "data": { "userId": "...", "online": true } }

// When a message is sent via REST (broadcasts to all in match room)
{ "type": "message", "data": { "id": "...", "matchId": "...", "senderId": "...", "content": "...", "createdAt": "..." } }

// When partner is typing
{ "type": "typing", "data": { "userId": "...", "isTyping": true } }

// After ignition resolves (10–12 seconds after both users connect)
{ "type": "ignition_resolve", "data": { "firstSpeakerId": "user-id-or-null" } }
```

**`firstSpeakerId` interpretation:**
- `== your userId` → you speak first
- `!= your userId && != null` → partner speaks first
- `null` → shared start (both may begin; a prompt is shown)

---

## 8. Room Ignition Ritual System

The Ignition Ritual is a 10–15 second shared transition that occurs every time a new match becomes active. Its purpose: remove the awkward "who starts?" problem without introducing competition.

### Server Logic (`websocket.ts`)

1. When **two users connect** to the same `matchId`, an `IgnitionRoom` is created and a **12-second timer** starts.
2. Either user may send `ignition_tap` at any time during this window. Only the first tap per user is recorded.
3. **Resolution at 12s (or when both tap):**
   - One user tapped → they go first (`firstSpeakerId = their userId`)
   - Both tapped → earliest tap wins
   - Neither tapped → `firstSpeakerId = null` → shared start
4. `ignition_resolve` is broadcast to all clients in the room.
5. The `IgnitionRoom` object is deleted from memory.

### Client Phases (`components/ignition.tsx`)

| Phase | Duration | What happens |
|-------|----------|-------------|
| **Forming** | 0–2.4s | Background blur fades away. Two presence dots pulse. "A room is forming…" appears. |
| **Pulse** | 2.4s–resolve | The Latch Pulse (broken SVG arc) breathes slowly. Partner's icebreaker fades in. After 4s: "tap to signal presence" hint. |
| **Resolved** | ~2.8s | Arc gap closes and locks. Center dot appears. Result text shown. |

**Result text:**
- First speaker: `"You are first in this room."` (then input autofocuses)
- Second speaker: nothing shown — their partner's message arrives naturally
- Shared: one of three prompts (`"Say something that doesn't need explanation."` / `"Begin anywhere."` / `"Whatever comes first."`)

### First-Line Rule

The **first message** of every conversation receives special treatment:
- Font size: `text-3xl` (vs `text-xl` for subsequent messages)
- Letter-spacing: `tracking-wide`
- Fade-in duration: 1.2 seconds (vs 0.4s for subsequent messages)
- No typing indicator is shown before the first message arrives

This makes the opening of every conversation feel like speech entering a quiet space.

---

## 9. Design System

### Color System — Time of Day

A `useTimeOfDay` hook reads UTC time every minute and sets a `data-time` attribute on `<html>`. CSS custom properties respond:

| Time (UTC) | `data-time` | `--background` | `--foreground` | Feel |
|------------|-------------|----------------|----------------|------|
| 05:00–11:59 | `morning` | `#F4F1EA` (warm cream) | `#1A1611` | Soft, waking |
| 12:00–16:59 | `day` | `#E9E4DB` (cooler cream) | `#1A1611` | Clear, open |
| 17:00–20:59 | `evening` | `#2A211C` (dark warm) | `#C8A36A` (amber) | Warm, dim |
| 21:00–04:59 | `midnight` | `#0E0D0C` (near black) | `#8C7B68` (muted gold) | Still, late |

### Typography

- **Cormorant Garamond** (serif) — all messages, names, icebreakers, body text. Sizes: `text-xl` to `text-3xl` for messages, `text-4xl`+ for headers.
- **JetBrains Mono** (monospace) — all labels, timestamps, system text, button text, status indicators. Size: `text-xs` to `text-sm`, `uppercase tracking-widest`.

### Layout Rules

- `border-radius: 0` on every element, no exceptions
- No cards (no `bg-*` panels with borders)
- No chat bubbles (messages are plain text in the flow)
- No navigation bars or sidebars
- Max content width: `max-w-3xl` centered
- Scrollbars: hidden (`hide-scrollbar` utility class)

---

## 10. Authentication

OneChat uses **Replit Auth** — an OpenID Connect (OIDC) flow backed by Replit's identity provider.

### Flow

1. User clicks "Enter" → `GET /api/login?returnTo=/`
2. Redirected to Replit's OIDC authorization endpoint
3. User consents → Replit redirects to `GET /api/auth/callback?code=...&state=...`
4. Server exchanges code for tokens, creates a signed session cookie (`SESSION_SECRET`)
5. User is now authenticated for all subsequent requests

### Session

- **Cookie name:** `connect.sid` (Express session)
- **Signing key:** `SESSION_SECRET` environment variable (required)
- **TTL:** 10 minutes for OIDC state cookie; Express session is persistent per browser session

### User Identity

`req.user` contains `{ id, name, email, profileImage }`. The `id` is the Replit user ID — used as the foreign key throughout the database.

---

## 11. Running Locally

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database (or use Replit's built-in)

### Setup

```bash
# Install dependencies
pnpm install

# Push database schema (dev only — never run on production)
pnpm --filter @workspace/db run push

# Run API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Run frontend (port 19116)
pnpm --filter @workspace/onechat run dev
```

### After Code Changes

```bash
# After any change to openapi.yaml:
pnpm --filter @workspace/api-spec run codegen

# After any schema change in lib/db/src/schema/:
pnpm --filter @workspace/db run push

# Full typecheck (always run before deploying):
pnpm run typecheck
```

---

## 12. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✓ | PostgreSQL connection string. Format: `postgres://user:pass@host:5432/db` |
| `SESSION_SECRET` | ✓ | Random string used to sign session cookies. Min 32 chars recommended. |
| `REPL_ID` | auto | Set by Replit. Used for OIDC client registration. |
| `REPLIT_DOMAINS` | auto | Set by Replit in production. Comma-separated deployed domains. Used for CORS. |
| `ISSUER_URL` | auto | OIDC issuer. Defaults to `https://replit.com/oidc`. |
| `PORT` | auto | Port for the API server. Set by Replit workflow config. Defaults to 8080. |

**Never commit `.env` files.** On Replit, set secrets via the Secrets panel.

---

## 13. Deployment

OneChat is designed to deploy on Replit with one click.

### Steps

1. Ensure `DATABASE_URL` and `SESSION_SECRET` are set in Replit Secrets.
2. Click **Deploy** in the Replit UI (or use `suggest_deploy`).
3. Replit builds and serves the app on a `.replit.app` domain with automatic TLS.

### What the Deploy Does

- Builds the API server with esbuild → `dist/index.mjs`
- Runs the Vite build for the frontend → static files
- Starts the Express server which serves both the API and (in production) acts behind Replit's reverse proxy

### Production vs Development

| Aspect | Development | Production |
|--------|-------------|------------|
| CORS | All origins allowed | Restricted to `REPLIT_DOMAINS` |
| TLS | HTTP (proxied by Replit dev) | HTTPS automatic |
| Database | Dev DB via `DATABASE_URL` | Production DB (separate secret) |
| Logs | Pretty-printed Pino | JSON Pino (structured) |

---

## 14. Security Model

### What's Protected

| Protection | How |
|-----------|-----|
| All API routes require auth | `req.isAuthenticated()` check, 401 if not signed in |
| Users can only read their own matches | `user1Id === userId \|\| user2Id === userId` check on every match/message query |
| Users can only send messages to matches they're in | Same ownership check |
| One match per day per user | Unique DB indexes — not just application logic |
| Blocked users cannot be re-matched | `notExists` block check in matchmaking query |
| Input validation on all write endpoints | Zod schemas on profiles, messages, match-end |
| Message length capped | 2000 characters max |
| Profile field lengths capped | displayName 50 chars, icebreaker 280 chars, avatarUrl 500 chars |
| Request body size capped | 800kb limit on JSON bodies (supports base64 avatar data URLs) |
| CORS locked in production | Only domains in `REPLIT_DOMAINS` allowed |
| Session cookies signed | `SESSION_SECRET` required |

### What to Know Before Going Public

1. **No rate limiting** — the API has no per-IP or per-user rate limits. A determined user could spam the matchmaking endpoint. Consider adding `express-rate-limit` before high-traffic launch.

2. **Avatar URLs are not validated for content** — users can set any URL as their avatar, including URLs that track visitors. There is no server-side image proxying. If privacy is a concern, proxy avatars through your server or restrict to a known CDN.

3. **WebSocket authentication is by trust** — the WS server accepts `userId` as a query parameter and trusts it. It does not re-verify the session on the WS connection. This means a user who knows their own `matchId` and `userId` can connect. Since `matchId` is a UUID returned only to authenticated users and `userId` is their own identity, the attack surface is minimal, but a future improvement would be to verify the WS handshake against the session.

4. **In-memory ignition state** — if the API server restarts mid-ignition, the ritual resets. Users will need to reconnect. This is acceptable for a product with one match per day but worth noting.

5. **No email verification** — Replit Auth handles identity. Users' email addresses come from their Replit account and are not re-verified by OneChat.

---

## 15. Known Limitations & Future Work

### Current Limitations

| Area | Limitation |
|------|-----------|
| Matchmaking | Simple random selection from 10 candidates — no preference matching |
| Rate limiting | None — API has no request throttling |
| Push notifications | None — users must have the app open to see a new match |
| Avatar hosting | Client-side compressed to JPEG 256px and sent as data URL in JSON body (800kb limit) |
| WS auth | `userId` param trusted; not session-verified |
| Ignition state | In-memory only — lost on server restart |
| Search | No search across past conversations |
| PWA install | Manifest configured but service worker is minimal |

### Ideas for Future Versions

- **Push notifications** — notify users when a match is found (Web Push API)
- **Rate limiting** — `express-rate-limit` on the matchmaking and message endpoints
- **Preference tags** — optional topic tags to improve match quality
- **Server-sent ignition fallback** — for users who connect on slow networks after the WS timer has already started
- **Avatar proxy** — pipe external avatar images through the server to prevent tracking pixels
- **WebSocket session verification** — validate WS handshake against the Express session cookie
- **Export memories** — let users download their past conversations as plaintext

---

## Appendix: Key Design Decisions

### Why one match per day?

Scarcity creates intentionality. When you have unlimited connections, you treat each one as disposable. When you have exactly one, you invest in it.

### Why UTC midnight expiry?

A shared, unambiguous boundary. Everyone's room closes at the same moment regardless of timezone. This makes the "time remaining" line feel universal and fair.

### Why no winner/loser in Ignition?

The ritual determines who speaks first, not who "wins." The framing matters: *ritual before presence*, not *competition before chat*. Hiding the mechanism makes the conversation feel initiated rather than started.

### Why Cormorant Garamond + Inter + JetBrains Mono?

Cormorant is designed for large display sizes — it's humanist, warm, and literary. Inter is a highly-legible sans-serif optimised for screen text, used for message body content. JetBrains Mono is the clearest monospace typeface for small UI text (timestamps, labels, system messages). Together they create a "manuscript meets terminal" aesthetic: Cormorant for names and decorative elements, Inter for readable prose, Mono for metadata.

---

*Generated: June 2026 — OneChat v1.0*
