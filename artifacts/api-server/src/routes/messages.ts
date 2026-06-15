import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, matchesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const MESSAGE_MAX_LENGTH = 2000;

const sendMessageSchema = z.object({
  content: z.string().min(1).max(MESSAGE_MAX_LENGTH).trim(),
  replyToId: z.string().uuid().optional().nullable(),
});

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

    return res.json(messages.map(serializeMessage));
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

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }

  const { content, replyToId } = parsed.data;

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

    const today = new Date().toISOString().slice(0, 10);
    if (match.matchDate < today) {
      return res.status(403).json({ error: "Match has expired" });
    }

    const [message] = await db
      .insert(messagesTable)
      .values({
        matchId,
        senderId: userId,
        content,
        replyToId: replyToId ?? null,
      })
      .returning();

    const serialized = serializeMessage(message);

    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "message", data: serialized });
    } catch (_) {
      req.log.warn("WebSocket broadcast skipped — module not available");
    }

    return res.status(201).json(serialized);
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function serializeMessage(m: typeof messagesTable.$inferSelect) {
  return {
    id: m.id,
    matchId: m.matchId,
    senderId: m.senderId,
    content: m.content,
    replyToId: m.replyToId ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

export { router as messagesRouter };
