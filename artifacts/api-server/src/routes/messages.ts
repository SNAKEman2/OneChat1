import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, matchesTable } from "@workspace/db";
import { eq, lt, and, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const MESSAGE_MAX_LENGTH = 2000;
const IMAGE_URL_MAX_LENGTH = 2000;

const sendMessageSchema = z.object({
  content: z.string().min(0).max(MESSAGE_MAX_LENGTH).trim().default(""),
  replyToId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().max(IMAGE_URL_MAX_LENGTH).optional().nullable(),
  isViewOnce: z.boolean().optional().default(false),
}).refine((d) => d.content.length > 0 || (d.imageUrl && d.imageUrl.length > 0), {
  message: "Message must have content or an image",
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(MESSAGE_MAX_LENGTH).trim(),
});

const paginationSchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

// ─── GET messages ─────────────────────────────────────────────────────────────
router.get("/matches/:matchId/messages", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { matchId } = req.params;

  const pagination = paginationSchema.safeParse(req.query);
  const { before, limit } = pagination.success ? pagination.data : { before: undefined, limit: 30 };

  try {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.user1Id !== userId && match.user2Id !== userId) return res.status(403).json({ error: "Forbidden" });

    // Always fetch DESC (newest first) then reverse for chronological display.
    // No cursor → latest limit messages. With before → limit messages older than cursor.
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

    return res.json(messages.reverse().map((m) => serializeMessage(m, userId)));
  } catch (err) {
    req.log.error({ err }, "Failed to get messages");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST send message ────────────────────────────────────────────────────────
router.post("/matches/:matchId/messages", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { matchId } = req.params;

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { content, replyToId, imageUrl, isViewOnce } = parsed.data;

  try {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.user1Id !== userId && match.user2Id !== userId) return res.status(403).json({ error: "Forbidden" });
    if (match.status !== "active") return res.status(403).json({ error: "Match is not active" });

    const today = new Date().toISOString().slice(0, 10);
    if (match.matchDate < today) return res.status(403).json({ error: "Match has expired" });

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
        isViewOnce: imageUrl ? (isViewOnce ?? true) : false, // media is view-once by default
      })
      .returning();

    const serialized = serializeMessage(message, userId);

    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "message", data: serialized });
    } catch (_) {
      req.log.warn("WebSocket broadcast skipped");
    }

    return res.status(201).json(serialized);
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH edit message ───────────────────────────────────────────────────────
router.patch("/matches/:matchId/messages/:messageId", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { matchId, messageId } = req.params;

  const parsed = editMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  try {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId)).limit(1);
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.matchId !== matchId) return res.status(404).json({ error: "Message not found" });
    if (msg.senderId !== userId) return res.status(403).json({ error: "Cannot edit another user's message" });
    if (msg.isDeleted) return res.status(400).json({ error: "Cannot edit a deleted message" });
    if (msg.imageUrl) return res.status(400).json({ error: "Cannot edit an image message" });

    const [updated] = await db
      .update(messagesTable)
      .set({ content: parsed.data.content, editedAt: new Date() })
      .where(eq(messagesTable.id, messageId))
      .returning();

    const serialized = serializeMessage(updated, userId);

    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "message_edited", data: serialized });
    } catch (_) {}

    return res.json(serialized);
  } catch (err) {
    req.log.error({ err }, "Failed to edit message");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE message (unsend for both) ────────────────────────────────────────
router.delete("/matches/:matchId/messages/:messageId", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { matchId, messageId } = req.params;

  try {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId)).limit(1);
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.matchId !== matchId) return res.status(404).json({ error: "Message not found" });
    if (msg.senderId !== userId) return res.status(403).json({ error: "Cannot delete another user's message" });

    const [updated] = await db
      .update(messagesTable)
      .set({ isDeleted: true, content: "", imageUrl: null })
      .where(eq(messagesTable.id, messageId))
      .returning();

    const serialized = serializeMessage(updated, userId);

    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "message_deleted", data: { id: messageId } });
    } catch (_) {}

    return res.json(serialized);
  } catch (err) {
    req.log.error({ err }, "Failed to delete message");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST view-once viewed (marks media as seen so it disappears) ─────────────
router.post("/matches/:matchId/messages/:messageId/viewed", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  const { matchId, messageId } = req.params;

  try {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId)).limit(1);
    if (!msg || msg.matchId !== matchId) return res.status(404).json({ error: "Not found" });

    // Verify caller is the RECIPIENT (not the sender) — sender can't self-mark viewed
    if (msg.senderId === userId) return res.status(403).json({ error: "Sender cannot mark own media as viewed" });

    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match || (match.user1Id !== userId && match.user2Id !== userId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!msg.isViewOnce || msg.viewedAt) return res.json({ success: true }); // idempotent

    const now = new Date();
    await db.update(messagesTable).set({ viewedAt: now }).where(eq(messagesTable.id, messageId));

    try {
      const { broadcastToMatch } = await import("../lib/websocket.js");
      broadcastToMatch(matchId, { type: "media_viewed", data: { id: messageId, viewedAt: now.toISOString() } });
    } catch (_) {}

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark viewed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function serializeMessage(m: typeof messagesTable.$inferSelect, viewerId?: string) {
  const isViewOnce = m.isViewOnce;
  const alreadyViewed = !!m.viewedAt;
  // If view-once and already viewed by the partner, strip imageUrl from the response
  const hideMedia = isViewOnce && alreadyViewed && viewerId && m.senderId !== viewerId;

  return {
    id: m.id,
    matchId: m.matchId,
    senderId: m.senderId,
    content: m.isDeleted ? "" : m.content,
    replyToId: m.replyToId ?? null,
    imageUrl: (m.isDeleted || hideMedia) ? null : (m.imageUrl ?? null),
    isDeleted: m.isDeleted,
    isViewOnce: m.isViewOnce,
    viewedAt: m.viewedAt ? m.viewedAt.toISOString() : null,
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  };
}

export { router as messagesRouter };
