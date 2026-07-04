import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, matchesTable } from "@workspace/db";
import { eq, asc, lt, and, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const MESSAGE_MAX_LENGTH = 2000;
const IMAGE_URL_MAX_LENGTH = 2000;

const sendMessageSchema = z.object({
  content: z.string().min(0).max(MESSAGE_MAX_LENGTH).trim().default(""),
  replyToId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().max(IMAGE_URL_MAX_LENGTH).optional().nullable(),
}).refine((d) => d.content.length > 0 || (d.imageUrl && d.imageUrl.length > 0), {
  message: "Message must have content or an image",
});

const paginationSchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

router.get("/matches/:matchId/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;
  const { matchId } = req.params;

  const pagination = paginationSchema.safeParse(req.query);
  const { before, limit } = pagination.success ? pagination.data : { before: undefined, limit: 30 };

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

    // Consistent strategy: always fetch DESC (newest first) then reverse for ASC display.
    // Without a cursor: fetches the LATEST `limit` messages.
    // With a `before` cursor: fetches `limit` messages older than that message.
    let whereClause;
    if (before) {
      const [cursorMsg] = await db
        .select({ createdAt: messagesTable.createdAt })
        .from(messagesTable)
        .where(eq(messagesTable.id, before))
        .limit(1);
      whereClause = cursorMsg
        ? and(eq(messagesTable.matchId, matchId), lt(messagesTable.createdAt, cursorMsg.createdAt))
        : eq(messagesTable.matchId, matchId);
    } else {
      whereClause = eq(messagesTable.matchId, matchId);
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(whereClause)
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);

    // Reverse to get chronological order (oldest first)
    const ordered = messages.reverse();

    return res.json(ordered.map(serializeMessage));
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

  const { content, replyToId, imageUrl } = parsed.data;

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

    // Validate replyToId belongs to the same match
    if (replyToId) {
      const [quotedMsg] = await db
        .select({ id: messagesTable.id, matchId: messagesTable.matchId })
        .from(messagesTable)
        .where(eq(messagesTable.id, replyToId))
        .limit(1);
      if (!quotedMsg || quotedMsg.matchId !== matchId) {
        return res.status(400).json({ error: "Invalid replyToId" });
      }
    }

    const [message] = await db
      .insert(messagesTable)
      .values({
        matchId,
        senderId: userId,
        content: content || "",
        replyToId: replyToId ?? null,
        imageUrl: imageUrl ?? null,
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

// A3: Mark messages as read — persists readAt on partner's unread messages + broadcasts
router.post("/matches/:matchId/messages/read", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { matchId } = req.params;

  try {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.user1Id !== userId && match.user2Id !== userId) return res.status(403).json({ error: "Forbidden" });

    const now = new Date();
    const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;

    // Persist readAt on partner's messages that haven't been read yet
    await db
      .update(messagesTable)
      .set({ readAt: now })
      .where(
        and(
          eq(messagesTable.matchId, matchId),
          eq(messagesTable.senderId, partnerId),
          sql`${messagesTable.readAt} IS NULL`
        )
      );

    // Broadcast read receipt to partner via WS
    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "read", data: { userId, lastReadAt: now.toISOString() } });
    } catch (_) {}

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark read");
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
    imageUrl: m.imageUrl ?? null,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  };
}

export { router as messagesRouter };
