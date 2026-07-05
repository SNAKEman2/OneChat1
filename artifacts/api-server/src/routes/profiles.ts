import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const displayNameSchema = z.string().min(1).max(50).trim();
const icebreakerSchema = z.string().min(1).max(280).trim();
const avatarUrlSchema = z.string().max(400_000).optional().nullable();
const auraSchema = z.enum(["calm", "curious", "reflective", "optimistic", "passionate"]).optional().nullable();

const NAME_COLORS = ["blue", "emerald", "gold", "crimson", "lavender"] as const;
const FONT_FAMILIES = ["sans", "mono", "serif"] as const;
const FONT_SIZES = ["sm", "md", "lg"] as const;

const patchProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  icebreaker: icebreakerSchema.optional(),
  avatarUrl: avatarUrlSchema,
  aura: auraSchema,
  // Premium cosmetics — silently ignored if not premium (enforced client-side too)
  nameColor: z.enum(NAME_COLORS).optional().nullable(),
  fontFamily: z.enum(FONT_FAMILIES).optional().nullable(),
  fontSize: z.enum(FONT_SIZES).optional().nullable(),
  wallpaper: z.string().max(64).optional().nullable(),
});

const setupProfileSchema = z.object({
  displayName: displayNameSchema,
  icebreaker: icebreakerSchema,
  avatarUrl: avatarUrlSchema,
  aura: auraSchema,
});

router.get("/profiles/me", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  try {
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.json(serializeProfile(profile));
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/profiles/me", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;

  const parsed = patchProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { displayName, avatarUrl, icebreaker, aura, nameColor, fontFamily, fontSize, wallpaper } = parsed.data;

  try {
    const [existing] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Profile not found" });

    const updateData: Partial<typeof profilesTable.$inferInsert> & { lastActive: Date } = {
      lastActive: new Date(),
    };
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl ?? null;
    if (icebreaker !== undefined) updateData.icebreaker = icebreaker;
    if (aura !== undefined) updateData.aura = aura ?? null;

    // Premium cosmetics — only apply if user is premium
    if (existing.isPremium) {
      if (nameColor !== undefined) updateData.nameColor = nameColor ?? null;
      if (fontFamily !== undefined) updateData.fontFamily = fontFamily ?? null;
      if (fontSize !== undefined) updateData.fontSize = fontSize ?? null;
      if (wallpaper !== undefined) updateData.wallpaper = wallpaper ?? null;
    }

    const [updated] = await db
      .update(profilesTable)
      .set(updateData)
      .where(eq(profilesTable.userId, userId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Profile not found" });
    return res.json(serializeProfile(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/profiles/setup", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;

  const parsed = setupProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { displayName, avatarUrl, icebreaker, aura } = parsed.data;

  try {
    const existing = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: "Profile already exists" });

    const [profile] = await db
      .insert(profilesTable)
      .values({ userId, displayName, avatarUrl: avatarUrl ?? null, icebreaker, aura: aura ?? null })
      .returning();

    return res.status(201).json(serializeProfile(profile));
  } catch (err) {
    req.log.error({ err }, "Failed to create profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Request premium — sets premiumRequestedAt; dev reviews manually
router.post("/profiles/me/request-premium", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const userId = req.user!.id;
  try {
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (profile.isPremium) return res.json({ success: true, alreadyPremium: true });

    await db
      .update(profilesTable)
      .set({ premiumRequestedAt: new Date() })
      .where(eq(profilesTable.userId, userId));

    return res.json({ success: true, alreadyPremium: false });
  } catch (err) {
    req.log.error({ err }, "Failed to request premium");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Grant premium — dev-only endpoint; protected by a shared secret header
router.post("/profiles/:targetUserId/grant-premium", async (req, res) => {
  const devSecret = process.env.DEV_SECRET;
  if (!devSecret || req.headers["x-dev-secret"] !== devSecret) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { targetUserId } = req.params;
  try {
    const [updated] = await db
      .update(profilesTable)
      .set({ isPremium: true, premiumGrantedAt: new Date() })
      .where(eq(profilesTable.userId, targetUserId))
      .returning();
    if (!updated) return res.status(404).json({ error: "User not found" });
    return res.json({ success: true, profile: serializeProfile(updated) });
  } catch (err) {
    req.log.error({ err }, "Failed to grant premium");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function serializeProfile(p: typeof profilesTable.$inferSelect) {
  return {
    id: p.id,
    userId: p.userId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    icebreaker: p.icebreaker,
    aura: p.aura ?? null,
    lastActive: p.lastActive.toISOString(),
    createdAt: p.createdAt.toISOString(),
    isPremium: p.isPremium,
    premiumGrantedAt: p.premiumGrantedAt ? p.premiumGrantedAt.toISOString() : null,
    nameColor: p.nameColor ?? null,
    fontFamily: p.fontFamily ?? null,
    fontSize: p.fontSize ?? null,
    wallpaper: p.wallpaper ?? null,
  };
}

export { router as profilesRouter };
