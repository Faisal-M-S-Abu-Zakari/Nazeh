import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { db, sessions, staffUsers } from "@workspace/db";
import { hashToken, requireAuth } from "../middlewares/auth";
import { parseRequest } from "../lib/validation";

const router: IRouter = Router();
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

router.post("/auth/login", async (req, res) => {
  const body = parseRequest(LoginBody, req.body, res);
  if (!body) return;

  const [user] = await db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.email, body.email.trim().toLowerCase()))
    .limit(1);

  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
  });

  res.json({
    token,
    expiresAt,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.get("/auth/me", requireAuth, (_req, res) => {
  res.json(res.locals["staff"]);
});

router.post("/auth/logout", requireAuth, async (_req, res) => {
  await db.delete(sessions).where(eq(sessions.id, res.locals["sessionId"] as string));
  res.status(204).end();
});

export default router;