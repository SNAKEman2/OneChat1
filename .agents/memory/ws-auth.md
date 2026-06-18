---
name: WS session auth pattern
description: WebSocket upgrade requests bypass Express middleware; session verification must be done manually inside the connection handler.
---

# Pattern

WebSocket connections come in as HTTP upgrade requests before the WS handshake. Express's `authMiddleware` never runs for them. To verify sessions:

```ts
import { parse as parseCookie } from "cookie";
import { getSession, SESSION_COOKIE } from "./auth";

wss.on("connection", async (ws, req) => {
  // 1. Try Authorization: Bearer <sid> header first
  const authHeader = req.headers["authorization"];
  let sid: string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    sid = authHeader.slice(7);
  } else {
    const cookies = parseCookie(req.headers.cookie ?? "");
    sid = cookies[SESSION_COOKIE];
  }

  if (!sid) { ws.close(1008, "Unauthorized"); return; }

  const session = await getSession(sid);
  if (!session?.user?.id) { ws.close(1008, "Invalid session"); return; }

  const userId = session.user.id; // verified — do NOT trust caller-supplied userId
  ...
```

**Why:** Before this hardening, the userId was read from a caller-supplied URL query param (`?userId=`) which is trivially spoofable. With session verification, userId comes from the signed, DB-backed session.

**How to apply:** The `cookie` package must be explicitly added to `artifacts/api-server`'s dependencies (even though it's a transitive dep of `cookie-parser`) so the import is clean and versioned. The connection handler must be `async`.
