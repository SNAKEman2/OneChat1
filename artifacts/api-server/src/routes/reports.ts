import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable, blocksTable, matchesTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const createReportSchema = z.object({
  reportedUserId: z.string().min(1),
  matchId: z.string().uuid().optional().nullable(),
  reason: z.enum(["spam", "harassment", "inappropriate", "other"]),
  details: z.string().max(1000).optional().nullable(),
});

// POST /reports
router.post("/reports", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;

  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { reportedUserId, matchId, reason, details } = parsed.data;

  if (reportedUserId === userId) return res.status(400).json({ error: "Cannot report yourself" });

  // Verify reporter was in the match if matchId provided
  if (matchId) {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match || (match.user1Id !== userId && match.user2Id !== userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  try {
    const [report] = await db
      .insert(reportsTable)
      .values({ reporterId: userId, reportedUserId, matchId: matchId ?? null, reason, details: details ?? null })
      .returning();

    return res.status(201).json({ id: report.id, success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /blocks — list users blocked by the current user
router.get("/blocks", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;

  try {
    const blocks = await db
      .select()
      .from(blocksTable)
      .where(eq(blocksTable.blockerId, userId));

    return res.json(blocks.map((b) => ({ id: b.id, blockedId: b.blockedId, createdAt: b.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get blocks");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /blocks/:blockedId — unblock a user
router.delete("/blocks/:blockedId", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { blockedId } = req.params;

  try {
    await db
      .delete(blocksTable)
      .where(and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, blockedId)));

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to unblock");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as moderationRouter };
