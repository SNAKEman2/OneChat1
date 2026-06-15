import { pgTable, text, timestamp, uuid, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchStatusEnum = ["active", "ended_by_user_1", "ended_by_user_2", "blocked"] as const;
export type MatchStatus = typeof matchStatusEnum[number];

export const matchesTable = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  user1Id: text("user_1_id").notNull(),
  user2Id: text("user_2_id").notNull(),
  matchDate: date("match_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("matches_user1_date_idx").on(t.user1Id, t.matchDate),
  uniqueIndex("matches_user2_date_idx").on(t.user2Id, t.matchDate),
]);

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
