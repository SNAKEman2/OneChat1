import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportReasonsEnum = ["spam", "harassment", "inappropriate", "other"] as const;
export type ReportReason = typeof reportReasonsEnum[number];

export const reportsTable = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: text("reporter_id").notNull(),
  reportedUserId: text("reported_user_id").notNull(),
  matchId: uuid("match_id"),
  reason: text("reason").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
