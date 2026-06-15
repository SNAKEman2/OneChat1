import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, profilesTable, blocksTable, messagesTable } from "@workspace/db";
import { eq, and, or, ne, notExists, sql, count } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const endMatchSchema = z.object({
  block: z.boolean(),
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
              displayName: partnerProfile.displayName,
              avatarUrl: partnerProfile.avatarUrl,
              icebreaker: partnerProfile.icebreaker,
            }
          : null,
        matchDate: existingMatch.matchDate,
        expiresAt: midnightUTC(),
      });
    }

    // No match today — attempt matchmaking
    const oneCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const candidates = await db
      .select({ userId: profilesTable.userId })
      .from(profilesTable)
      .where(
        and(
          ne(profilesTable.userId, userId),
          sql`${profilesTable.lastActive} > ${oneCutoff}`,
          notExists(
            db
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
            db
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

    if (candidates.length === 0) {
      return res.json({
        status: "waiting",
        matchId: null,
        partner: null,
        matchDate: today,
        expiresAt: midnightUTC(),
      });
    }

    const candidate = candidates[Math.floor(Math.random() * candidates.length)];

    const [newMatch] = await db
      .insert(matchesTable)
      .values({
        user1Id: userId,
        user2Id: candidate.userId,
        matchDate: today,
        status: "active",
      })
      .returning();

    const [partnerProfile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, candidate.userId))
      .limit(1);

    return res.json({
      status: "active",
      matchId: newMatch.id,
      partner: partnerProfile
        ? {
            displayName: partnerProfile.displayName,
            avatarUrl: partnerProfile.avatarUrl,
            icebreaker: partnerProfile.icebreaker,
          }
        : null,
      matchDate: newMatch.matchDate,
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

router.get("/matches/archive", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;
  const today = todayUTC();

  try {
    const pastMatches = await db
      .select()
      .from(matchesTable)
      .where(
        and(
          or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)),
          sql`${matchesTable.matchDate} < ${today}`
        )
      )
      .orderBy(sql`${matchesTable.matchDate} DESC`)
      .limit(100);

    const results = await Promise.all(
      pastMatches.map(async (match) => {
        const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;

        const [partnerProfile] = await db
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.userId, partnerId))
          .limit(1);

        const [msgCountResult] = await db
          .select({ count: count() })
          .from(messagesTable)
          .where(eq(messagesTable.matchId, match.id));

        const [firstMsg] = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.matchId, match.id))
          .orderBy(sql`${messagesTable.createdAt} ASC`)
          .limit(1);

        return {
          matchId: match.id,
          matchDate: match.matchDate,
          partnerName: partnerProfile?.displayName ?? "Unknown",
          partnerAvatarUrl: partnerProfile?.avatarUrl ?? null,
          messageCount: msgCountResult?.count ?? 0,
          status: match.status,
          firstMessage: firstMsg?.content ?? null,
        };
      })
    );

    return res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to get match archive");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as matchesRouter };
