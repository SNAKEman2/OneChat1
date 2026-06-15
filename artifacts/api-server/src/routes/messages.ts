import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, matchesTable } from "@workspace/db";
import { eq, and, or, asc } from "drizzle-orm";

const router = Router();

router.get("/matches/:matchId/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;
  const { matchId } = req.params;

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

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.matchId, matchId))
      .orderBy(asc(messagesTable.createdAt));

    return res.json(messages.map((m) => ({
      id: m.id,
      matchId: m.matchId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get messages");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/matches/:matchId/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;
  const { matchId } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ error: "content is required" });
  }

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

    if (match.status !== "active") {
      return res.status(403).json({ error: "Match is not active" });
    }

    // Check if match has expired (past midnight UTC)
    const today = new Date().toISOString().slice(0, 10);
    if (match.matchDate < today) {
      return res.status(403).json({ error: "Match has expired" });
    }

    const [message] = await db
      .insert(messagesTable)
      .values({
        matchId,
        senderId: userId,
        content: content.trim(),
      })
      .returning();

    const serialized = {
      id: message.id,
      matchId: message.matchId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };

    // Broadcast via WebSocket if available
    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "message", data: serialized });
    } catch (_) {
      // WS not available, skip
    }

    return res.status(201).json(serialized);
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as messagesRouter };
