import { Router } from "express";
import { db } from "@workspace/db";
import { messageReactionsTable, matchesTable, messagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const ALLOWED_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"] as const;

const reactSchema = z.object({
  emoji: z.enum(ALLOWED_EMOJIS),
});

// GET /matches/:matchId/messages/:messageId/reactions
router.get("/matches/:matchId/messages/:messageId/reactions", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const { matchId, messageId } = req.params;
  const userId = req.user!.id;

  try {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.user1Id !== userId && match.user2Id !== userId) return res.status(403).json({ error: "Forbidden" });

    const reactions = await db
      .select()
      .from(messageReactionsTable)
      .where(eq(messageReactionsTable.messageId, messageId));

    // Group by emoji
    const grouped: Record<string, { emoji: string; count: number; byMe: boolean }> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, byMe: false };
      grouped[r.emoji].count++;
      if (r.userId === userId) grouped[r.emoji].byMe = true;
    }

    return res.json(Object.values(grouped));
  } catch (err) {
    req.log.error({ err }, "Failed to get reactions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /matches/:matchId/messages/:messageId/reactions
router.post("/matches/:matchId/messages/:messageId/reactions", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const { matchId, messageId } = req.params;
  const userId = req.user!.id;

  const parsed = reactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid emoji", details: parsed.error.issues });

  const { emoji } = parsed.data;

  try {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.user1Id !== userId && match.user2Id !== userId) return res.status(403).json({ error: "Forbidden" });

    const [msg] = await db.select().from(messagesTable)
      .where(and(eq(messagesTable.id, messageId), eq(messagesTable.matchId, matchId)))
      .limit(1);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    await db
      .insert(messageReactionsTable)
      .values({ messageId, userId, emoji })
      .onConflictDoNothing();

    // Broadcast via WS
    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "reaction_add", data: { messageId, userId, emoji } });
    } catch (_) {}

    return res.status(201).json({ messageId, emoji, userId });
  } catch (err) {
    req.log.error({ err }, "Failed to add reaction");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /matches/:matchId/messages/:messageId/reactions/:emoji
router.delete("/matches/:matchId/messages/:messageId/reactions/:emoji", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const { matchId, messageId, emoji } = req.params;
  const userId = req.user!.id;

  try {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.user1Id !== userId && match.user2Id !== userId) return res.status(403).json({ error: "Forbidden" });

    await db
      .delete(messageReactionsTable)
      .where(
        and(
          eq(messageReactionsTable.messageId, messageId),
          eq(messageReactionsTable.userId, userId),
          eq(messageReactionsTable.emoji, decodeURIComponent(emoji))
        )
      );

    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "reaction_remove", data: { messageId, userId, emoji: decodeURIComponent(emoji) } });
    } catch (_) {}

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove reaction");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as reactionsRouter };
