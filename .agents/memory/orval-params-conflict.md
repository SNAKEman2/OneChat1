---
name: Orval params naming conflict
description: Adding query params to an endpoint that also has path params causes GetMatchMessagesParams to be generated in both Zod api.ts AND types/index, creating a TS2308 export ambiguity in lib/api-zod/src/index.ts.
---

# Problem

When you add query parameters to an OpenAPI `GET /matches/{matchId}/messages` endpoint (or any endpoint with a path param + new query params), Orval generates:

1. `lib/api-zod/src/generated/api.ts` — `export const GetMatchMessagesParams = zod.object(...)` (Zod schema for path + query params combined)
2. `lib/api-zod/src/generated/types/getMatchMessagesParams.ts` — `export type GetMatchMessagesParams = { before?: string; limit?: number }` (TS type for query params only)

`lib/api-zod/src/index.ts` does `export * from "./generated/api"` and `export * from "./generated/types"` — both export `GetMatchMessagesParams`, causing TS2308.

**Why:** Orval's Zod generator creates a combined path+query params schema while the Types generator creates a plain TS interface for just the query params, and they happen to share the same name.

# Fix

Update `lib/api-zod/src/index.ts` to use an explicit re-export list from `./generated/types`, omitting any name that conflicts with a Zod schema in `./generated/api`. The Zod schema version is more useful (it is a runtime validator AND a type), so keep it and drop the plain TS type.

```ts
export * from "./generated/api";
// explicit list — excludes GetMatchMessagesParams which conflicts with Zod schema
export type { ArchivedMatch } from "./generated/types";
// ... all other types, but NOT GetMatchMessagesParams
```

**How to apply:** After running `pnpm --filter @workspace/api-spec run codegen`, if a new endpoint with both path params and query params is added, check whether the codegen output produces a new `*Params` clash and update the explicit list accordingly.
