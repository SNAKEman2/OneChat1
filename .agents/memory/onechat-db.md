---
name: OneChat DB uniqueness
description: One-match-per-day enforcement is at the DB level, not application code.
---

matchesTable has unique indexes on (user1Id, matchDate) AND (user2Id, matchDate). This means:
- Each user can be user1 in at most one match per UTC day
- Each user can be user2 in at most one match per UTC day
- Combined: one match per user per UTC day, period

blocksTable has unique index on (blockerId, blockedId).

**Why:** Application-level enforcement would have race conditions in the matchmaking algorithm.

**How to apply:** If you change matching logic, don't remove these indexes. The midnightUTC() helper in artifacts/api-server/src/routes/matches.ts computes the next UTC midnight for match expiry.
