import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, profilesTable, blocksTable, messagesTable } from "@workspace/db";
import { eq, and, or, ne, notExists, sql, count, desc, asc, ilike } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const endMatchSchema = z.object({
  block: z.boolean(),
});

const archiveQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function midnightUTC(): string {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return midnight.toISOString();
}

router.get("/matches/today", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;
  const today = todayUTC();

  try {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!profile) {
      return res.json({ status: "no_profile", matchId: null, partner: null, matchDate: null, expiresAt: null });
    }

    await db
      .update(profilesTable)
      .set({ lastActive: new Date() })
      .where(eq(profilesTable.userId, userId));

    const [existingMatch] = await db
      .select()
      .from(matchesTable)
      .where(
        and(
          eq(matchesTable.matchDate, today),
          or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId))
        )
      )
      .limit(1);

    if (existingMatch) {
      const partnerId =
        existingMatch.user1Id === userId ? existingMatch.user2Id : existingMatch.user1Id;

      if (
        existingMatch.status === "ended_by_user_1" ||
        existingMatch.status === "ended_by_user_2" ||
        existingMatch.status === "blocked"
      ) {
        return res.json({
          status: existingMatch.status === "blocked" ? "blocked" : "ended",
          matchId: existingMatch.id,
          partner: null,
          matchDate: existingMatch.matchDate,
          expiresAt: midnightUTC(),
        });
      }

      const [partnerProfile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, partnerId))
        .limit(1);

      return res.json({
        status: "active",
        matchId: existingMatch.id,
        partner: partnerProfile
          ? {
              userId: partnerProfile.userId,
              displayName: partnerProfile.displayName,
              avatarUrl: partnerProfile.avatarUrl,
              icebreaker: partnerProfile.icebreaker,
              aura: partnerProfile.aura ?? null,
              lastActive: partnerProfile.lastActive.toISOString(),
            }
          : null,
        matchDate: existingMatch.matchDate,
        expiresAt: midnightUTC(),
      });
    }

    // No match today — attempt matchmaking inside an advisory-locked transaction.
    // pg_advisory_xact_lock ensures only one concurrent matchmaking attempt per userId
    // executes the check+insert at a time, preventing the cross-column duplicate race.
    const oneCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    type MatchRow = typeof matchesTable.$inferSelect;
    let newMatch: MatchRow | null = null;

    await db.transaction(async (tx) => {
      // Serialize per userId — lock is released automatically at transaction end
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

      // Re-check inside the lock (another request may have created a match already)
      const [existingInTx] = await tx
        .select()
        .from(matchesTable)
        .where(
          and(
            eq(matchesTable.matchDate, today),
            or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId))
          )
        )
        .limit(1);

      if (existingInTx) {
        newMatch = existingInTx;
        return;
      }

      const candidates = await tx
        .select({ userId: profilesTable.userId })
        .from(profilesTable)
        .where(
          and(
            ne(profilesTable.userId, userId),
            sql`${profilesTable.lastActive} > ${oneCutoff}`,
            notExists(
              tx
                .select({ id: matchesTable.id })
                .from(matchesTable)
                .where(
                  and(
                    eq(matchesTable.matchDate, today),
                    or(
                      eq(matchesTable.user1Id, profilesTable.userId),
                      eq(matchesTable.user2Id, profilesTable.userId)
                    )
                  )
                )
            ),
            notExists(
              tx
                .select({ id: blocksTable.id })
                .from(blocksTable)
                .where(
                  or(
                    and(
                      eq(blocksTable.blockerId, userId),
                      eq(blocksTable.blockedId, profilesTable.userId)
                    ),
                    and(
                      eq(blocksTable.blockerId, profilesTable.userId),
                      eq(blocksTable.blockedId, userId)
                    )
                  )
                )
            )
          )
        )
        .limit(10);

      if (candidates.length === 0) return; // newMatch stays null

      const candidate = candidates[Math.floor(Math.random() * candidates.length)];

      const [inserted] = await tx
        .insert(matchesTable)
        .values({
          user1Id: userId,
          user2Id: candidate.userId,
          matchDate: today,
          status: "active",
        })
        .returning();

      newMatch = inserted ?? null;
    });

    if (!newMatch) {
      return res.json({ status: "waiting", matchId: null, partner: null, matchDate: today, expiresAt: midnightUTC() });
    }

    const matchRow = newMatch as MatchRow;
    const partnerId = matchRow.user1Id === userId ? matchRow.user2Id : matchRow.user1Id;
    const [partnerProfile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, partnerId))
      .limit(1);

    return res.json({
      status: "active",
      matchId: matchRow.id,
      partner: partnerProfile
        ? {
            userId: partnerProfile.userId,
            displayName: partnerProfile.displayName,
            avatarUrl: partnerProfile.avatarUrl,
            icebreaker: partnerProfile.icebreaker,
            aura: partnerProfile.aura ?? null,
            lastActive: partnerProfile.lastActive.toISOString(),
          }
        : null,
      matchDate: matchRow.matchDate,
      expiresAt: midnightUTC(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get today match");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/matches/:matchId/end", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;
  const { matchId } = req.params;

  const parsed = endMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }

  const { block } = parsed.data;

  try {
    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, matchId))
      .limit(1);

    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    if (match.user1Id !== userId && match.user2Id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const newStatus = block
      ? "blocked"
      : match.user1Id === userId
      ? "ended_by_user_1"
      : "ended_by_user_2";

    const [updated] = await db
      .update(matchesTable)
      .set({ status: newStatus })
      .where(eq(matchesTable.id, matchId))
      .returning();

    if (block) {
      const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
      await db
        .insert(blocksTable)
        .values({ blockerId: userId, blockedId: partnerId })
        .onConflictDoNothing();
    }

    // Broadcast match_ended event via WebSocket
    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "match_ended", data: { status: newStatus } });
    } catch (_) {}

    return res.json({
      status: newStatus === "blocked" ? "blocked" : "ended",
      matchId: updated.id,
      partner: null,
      matchDate: updated.matchDate,
      expiresAt: midnightUTC(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to end match");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Section C2+C3: Archive with search and pagination
router.get("/matches/archive", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;
  const today = todayUTC();

  const qParsed = archiveQuerySchema.safeParse(req.query);
  const { q, page, limit } = qParsed.success ? qParsed.data : { q: undefined, page: 1, limit: 20 };
  const offset = (page - 1) * limit;

  try {
    // C3: Consolidated query — join profiles and aggregate messages to avoid N+1
    // We fetch a page of matches, then resolve partner profiles + message stats in two bulk queries
    const pastMatches = await db
      .select()
      .from(matchesTable)
      .where(
        and(
          or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)),
          sql`${matchesTable.matchDate} < ${today}`
        )
      )
      .orderBy(desc(matchesTable.matchDate))
      .limit(limit)
      .offset(offset);

    if (pastMatches.length === 0) {
      return res.json([]);
    }

    const partnerIds = pastMatches.map((m) =>
      m.user1Id === userId ? m.user2Id : m.user1Id
    );
    const matchIds = pastMatches.map((m) => m.id);

    // Bulk fetch partner profiles
    const partnerProfiles = await db
      .select()
      .from(profilesTable)
      .where(sql`${profilesTable.userId} = ANY(${partnerIds})`);

    const profileMap = new Map(partnerProfiles.map((p) => [p.userId, p]));

    // Bulk fetch message counts + first + last message per match
    const msgStats = await db
      .select({
        matchId: messagesTable.matchId,
        count: count(),
        firstCreatedAt: sql<string>`min(${messagesTable.createdAt})`,
        lastCreatedAt: sql<string>`max(${messagesTable.createdAt})`,
        firstContent: sql<string>`(array_agg(${messagesTable.content} ORDER BY ${messagesTable.createdAt} ASC))[1]`,
      })
      .from(messagesTable)
      .where(sql`${messagesTable.matchId} = ANY(${matchIds})`)
      .groupBy(messagesTable.matchId);

    const statsMap = new Map(msgStats.map((s) => [s.matchId, s]));

    let results = pastMatches.map((match) => {
      const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
      const partnerProfile = profileMap.get(partnerId);
      const stats = statsMap.get(match.id);

      // C1: Conversation duration in minutes
      let conversationDuration: number | null = null;
      if (stats?.firstCreatedAt && stats?.lastCreatedAt) {
        const diff = new Date(stats.lastCreatedAt).getTime() - new Date(stats.firstCreatedAt).getTime();
        conversationDuration = Math.round(diff / 60000);
      }

      return {
        matchId: match.id,
        matchDate: match.matchDate,
        partnerName: partnerProfile?.displayName ?? "Unknown",
        partnerAvatarUrl: partnerProfile?.avatarUrl ?? null,
        partnerIcebreaker: partnerProfile?.icebreaker ?? null,
        partnerAura: partnerProfile?.aura ?? null,
        messageCount: Number(stats?.count ?? 0),
        status: match.status,
        firstMessage: stats?.firstContent ?? null,
        conversationDuration,
      };
    });

    // C2: Client-side search filter (applied after fetch for simplicity)
    if (q && q.trim()) {
      const lower = q.toLowerCase().trim();
      results = results.filter(
        (r) =>
          r.partnerName.toLowerCase().includes(lower) ||
          (r.partnerIcebreaker?.toLowerCase().includes(lower) ?? false) ||
          (r.firstMessage?.toLowerCase().includes(lower) ?? false)
      );
    }

    return res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to get match archive");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as matchesRouter };
