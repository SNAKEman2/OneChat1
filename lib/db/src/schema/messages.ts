import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull(),
  senderId: text("sender_id").notNull(),
  content: text("content").notNull(),
  replyToId: uuid("reply_to_id"),
  imageUrl: text("image_url"),
  // kept for backward-compat; not exposed in API responses
  readAt: timestamp("read_at", { withTimezone: true }),
  // view-once media
  isViewOnce: boolean("is_view_once").notNull().default(false),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  // edit / delete
  isDeleted: boolean("is_deleted").notNull().default(false),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
