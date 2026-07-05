import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  icebreaker: text("icebreaker").notNull(),
  aura: text("aura"),
  lastActive: timestamp("last_active", { withTimezone: true }).notNull().defaultNow(),
  // Premium
  isPremium: boolean("is_premium").notNull().default(false),
  premiumGrantedAt: timestamp("premium_granted_at", { withTimezone: true }),
  premiumRequestedAt: timestamp("premium_requested_at", { withTimezone: true }),
  // Premium cosmetics (null = default/locked)
  nameColor: text("name_color"),        // e.g. "blue" | "emerald" | "gold" | "crimson" | "lavender"
  fontFamily: text("font_family"),      // e.g. "sans" | "mono" | "serif"
  fontSize: text("font_size"),          // e.g. "sm" | "md" | "lg"
  wallpaper: text("wallpaper"),         // slug tied to theme
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  lastActive: true,
  isPremium: true,
  premiumGrantedAt: true,
  premiumRequestedAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
