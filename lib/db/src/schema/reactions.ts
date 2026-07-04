import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messageReactionsTable = pgTable("message_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull(),
  userId: text("user_id").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("reactions_unique_idx").on(t.messageId, t.userId, t.emoji),
]);

export const insertReactionSchema = createInsertSchema(messageReactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReaction = z.infer<typeof insertReactionSchema>;
export type MessageReaction = typeof messageReactionsTable.$inferSelect;
