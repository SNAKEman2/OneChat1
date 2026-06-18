---
name: useGetMatchMessages signature
description: After adding pagination query params via codegen, the hook signature changed; all existing call sites must be updated.
---

# Before codegen (no query params)
```ts
useGetMatchMessages(matchId, { query: { queryKey: ... } })
getGetMatchMessagesQueryKey(matchId)
```

# After codegen (with before/limit query params)
```ts
useGetMatchMessages(matchId, params?, options?)
useGetMatchMessages(matchId, undefined, { query: { queryKey: ... } })
getGetMatchMessagesQueryKey(matchId, params?)
```

**Why:** Orval inserts an optional `params` argument between `matchId` and `options` whenever the endpoint gains query parameters. Existing call sites that passed the options object as the second arg get TS2353.

**How to apply:** Any time codegen adds query params to an existing hook, search all call sites with `grep -r "useGetMatchMessages\|getGetMatchMessagesQueryKey"` and insert `undefined` (or explicit params) as the second argument. Same pattern applies to any other hook that gains query params.

**Affected files (as of Phase 2):**
- `artifacts/onechat/src/pages/room.tsx`
- `artifacts/onechat/src/pages/frozen-room.tsx`
