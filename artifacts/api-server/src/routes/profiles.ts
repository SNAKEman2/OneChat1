import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const displayNameSchema = z.string().min(1).max(50).trim();
const icebreakerSchema = z.string().min(1).max(280).trim();
// Accept both https:// URLs and data: URLs (for base64-encoded local uploads)
const avatarUrlSchema = z
  .string()
  .max(400_000)
  .optional()
  .nullable();

const patchProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  icebreaker: icebreakerSchema.optional(),
  avatarUrl: avatarUrlSchema,
});

const setupProfileSchema = z.object({
  displayName: displayNameSchema,
  icebreaker: icebreakerSchema,
  avatarUrl: avatarUrlSchema,
});

router.get("/profiles/me", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;
  try {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    return res.json(serializeProfile(profile));
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/profiles/me", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;

  const parsed = patchProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }

  const { displayName, avatarUrl, icebreaker } = parsed.data;

  try {
    const updateData: Partial<typeof profilesTable.$inferInsert> & { lastActive: Date } = {
      lastActive: new Date(),
    };
    if (displayName !== undefined) updateData.displayName = displayName;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl ?? null;
    if (icebreaker !== undefined) updateData.icebreaker = icebreaker;

    const [updated] = await db
      .update(profilesTable)
      .set(updateData)
      .where(eq(profilesTable.userId, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Profile not found" });
    }
    return res.json(serializeProfile(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/profiles/setup", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user!.id;

  const parsed = setupProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }

  const { displayName, avatarUrl, icebreaker } = parsed.data;

  try {
    const existing = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "Profile already exists" });
    }

    const [profile] = await db
      .insert(profilesTable)
      .values({
        userId,
        displayName,
        avatarUrl: avatarUrl ?? null,
        icebreaker,
      })
      .returning();

    return res.status(201).json(serializeProfile(profile));
  } catch (err) {
    req.log.error({ err }, "Failed to create profile");
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
    lastActive: p.lastActive.toISOString(),
    createdAt: p.createdAt.toISOString(),
  };
}

export { router as profilesRouter };
