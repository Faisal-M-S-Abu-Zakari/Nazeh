import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  CompleteCredentialBody,
  CreateStaffBody,
  IssueStaffPasswordResetParams,
  LoginBody,
  RenewStaffInviteParams,
  UpdateStaffBody,
  UpdateStaffParams,
} from "@workspace/api-zod";
import {
  credentialTokens,
  db,
  sessions,
  staffUsers,
  type StaffRole,
} from "@workspace/db";
import {
  hashToken,
  isKnownDevelopmentDemo,
  requireAuth,
  allowRoles,
} from "../middlewares/auth";
import {
  hashCredentialToken,
  passwordPolicyError,
} from "../lib/security";
import { parseRequest } from "../lib/validation";
import {
  createLoginRateLimit,
  createPostgresLoginRateLimitStore,
  loginAttemptKeys,
} from "../lib/loginRateLimit";

const router: IRouter = Router();
const loginRateLimit = createLoginRateLimit(createPostgresLoginRateLimitStore(db));
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const INVITE_LIFETIME_MS = 48 * 60 * 60 * 1000;
const RESET_LIFETIME_MS = 60 * 60 * 1000;

const publicStaff = (user: typeof staffUsers.$inferSelect) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  active: user.active,
  passwordSet: Boolean(user.passwordSetAt),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

async function issueCredentialToken(
  userId: string,
  kind: "INVITE" | "PASSWORD_RESET",
  lifetimeMs: number,
) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(credentialTokens)
      .set({ consumedAt: now })
      .where(and(
        eq(credentialTokens.userId, userId),
        eq(credentialTokens.kind, kind),
        isNull(credentialTokens.consumedAt),
      ));
    await tx.insert(credentialTokens).values({
      userId,
      kind,
      tokenHash: hashCredentialToken(token),
      expiresAt: new Date(now.getTime() + lifetimeMs),
    });
  });
  return token;
}

router.post("/auth/login", async (req, res) => {
  // Starting the modern flow must discard any legacy browser identity,
  // including when the credentials submitted below are invalid.
  res.clearCookie("aqsa_session");
  const body = parseRequest(LoginBody, req.body, res);
  if (!body) return;
  const email = body.email.trim().toLowerCase();
  const password = body.password;
  const attemptKeys = loginAttemptKeys(req.ip, email);
  const rate = await loginRateLimit.check(attemptKeys);
  if (!rate.allowed) {
    res.set("Retry-After", String(rate.retryAfterSeconds));
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }

  const [user] = await db.select().from(staffUsers)
    .where(eq(staffUsers.email, email)).limit(1);
  const productionDemo = user &&
    (user.isDevelopmentDemo || isKnownDevelopmentDemo(user.id, user.email)) &&
    process.env.NODE_ENV === "production";
  if (
    !user ||
    !user.active ||
    productionDemo ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    await loginRateLimit.failure(attemptKeys);
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await loginRateLimit.success(attemptKeys);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
  });
  // A browser must never retain a legacy cookie alongside a modern staff
  // bearer session. The two identity stores are intentionally not merged.
  res.clearCookie("aqsa_session");
  res.json({ token, expiresAt, user: publicStaff(user) });
});

router.post("/auth/complete-credential", async (req, res) => {
  const body = parseRequest(CompleteCredentialBody, req.body, res);
  if (!body) return;
  const policyError = passwordPolicyError(body.password);
  if (policyError) {
    res.status(400).json({ error: policyError });
    return;
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(body.password, 12);
  const completed = await db.transaction(async (tx) => {
    const [claimed] = await tx.update(credentialTokens)
      .set({ consumedAt: now })
      .where(and(
        eq(credentialTokens.tokenHash, hashCredentialToken(body.token)),
        isNull(credentialTokens.consumedAt),
        gt(credentialTokens.expiresAt, now),
      ))
      .returning();
    if (!claimed) return false;
    const [user] = await tx.select().from(staffUsers)
      .where(eq(staffUsers.id, claimed.userId)).limit(1);
    if (
      !user ||
      (process.env.NODE_ENV === "production" &&
        (user.isDevelopmentDemo || isKnownDevelopmentDemo(user.id, user.email)))
    ) return false;
    await tx.update(staffUsers).set({
      passwordHash,
      passwordSetAt: now,
      active: claimed.kind === "INVITE" ? true : user.active,
      updatedAt: now,
    }).where(eq(staffUsers.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.update(credentialTokens).set({ consumedAt: now }).where(and(
      eq(credentialTokens.userId, user.id),
      isNull(credentialTokens.consumedAt),
    ));
    return true;
  });
  if (!completed) {
    res.status(400).json({ error: "Invalid or expired credential token" });
    return;
  }
  res.status(204).end();
});

router.get("/staff", requireAuth, allowRoles("ADMIN"), async (_req, res) => {
  const users = await db.select().from(staffUsers).orderBy(desc(staffUsers.createdAt));
  res.json({ items: users.map(publicStaff) });
});

router.post("/staff", requireAuth, allowRoles("ADMIN"), async (req, res) => {
  const body = parseRequest(CreateStaffBody, req.body, res);
  if (!body) return;
  const email = body.email.trim().toLowerCase();
  try {
    const passwordHash = await bcrypt.hash(randomBytes(48).toString("base64url"), 12);
    const [user] = await db.insert(staffUsers).values({
      email,
      name: body.name.trim(),
      role: body.role as StaffRole,
      passwordHash,
      active: false,
      passwordSetAt: null,
    }).returning();
    const inviteToken = await issueCredentialToken(user.id, "INVITE", INVITE_LIFETIME_MS);
    res.status(201).json({
      user: publicStaff(user),
      inviteToken,
      inviteExpiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
    });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A staff account with that email already exists" });
      return;
    }
    throw error;
  }
});

router.post("/staff/:staffId/invite", requireAuth, allowRoles("ADMIN"), async (req, res) => {
  const params = parseRequest(RenewStaffInviteParams, req.params, res);
  if (!params) return;
  const [user] = await db.select().from(staffUsers)
    .where(eq(staffUsers.id, params.staffId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Staff account not found" });
    return;
  }
  if (user.passwordSetAt || user.active) {
    res.status(409).json({ error: "Only pending staff accounts can be invited" });
    return;
  }
  const inviteToken = await issueCredentialToken(user.id, "INVITE", INVITE_LIFETIME_MS);
  res.json({ inviteToken, inviteExpiresAt: new Date(Date.now() + INVITE_LIFETIME_MS) });
});

router.post(
  "/staff/:staffId/password-reset",
  requireAuth,
  allowRoles("ADMIN"),
  async (req, res) => {
    const params = parseRequest(IssueStaffPasswordResetParams, req.params, res);
    if (!params) return;
    const [user] = await db.select().from(staffUsers)
      .where(eq(staffUsers.id, params.staffId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Staff account not found" });
      return;
    }
    const productionDemo = process.env.NODE_ENV === "production" &&
      (user.isDevelopmentDemo || isKnownDevelopmentDemo(user.id, user.email));
    if (productionDemo) {
      res.status(409).json({ error: "Development demo accounts cannot be reset in production" });
      return;
    }
    if (!user.active || !user.passwordSetAt) {
      res.status(409).json({
        error: "Only active staff accounts with a configured password can be reset",
      });
      return;
    }
    const resetToken = await issueCredentialToken(
      user.id,
      "PASSWORD_RESET",
      RESET_LIFETIME_MS,
    );
    res.json({
      resetToken,
      resetExpiresAt: new Date(Date.now() + RESET_LIFETIME_MS),
    });
  },
);

router.patch("/staff/:staffId", requireAuth, allowRoles("ADMIN"), async (req, res) => {
  const params = parseRequest(UpdateStaffParams, req.params, res);
  if (!params) return;
  const body = parseRequest(UpdateStaffBody, req.body, res);
  if (!body) return;
  if (Object.keys(body).length === 0) {
    res.status(400).json({ error: "At least one staff field must be provided" });
    return;
  }
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    // Serialize state-reducing staff mutations so concurrent requests cannot
    // each observe a different "last administrator" and remove both.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(81723041)`);
    const [existing] = await tx.select().from(staffUsers)
      .where(eq(staffUsers.id, params.staffId)).limit(1);
    if (!existing) return { kind: "notFound" as const };
    if (body.active === false && existing.id === res.locals["staff"].id) {
      return { kind: "selfDeactivate" as const };
    }
    if (body.role !== undefined && body.role !== "ADMIN" && existing.id === res.locals["staff"].id) {
      return { kind: "selfDemote" as const };
    }
    if (body.active === true && !existing.passwordSetAt) {
      return { kind: "pending" as const };
    }
    if (
      body.active === true &&
      process.env.NODE_ENV === "production" &&
      (existing.isDevelopmentDemo || isKnownDevelopmentDemo(existing.id, existing.email))
    ) {
      return { kind: "demo" as const };
    }
    const removesActiveAdmin = existing.active && existing.role === "ADMIN" &&
      (body.active === false || (body.role !== undefined && body.role !== "ADMIN"));
    if (removesActiveAdmin) {
      const activeAdmins = await tx.select({ id: staffUsers.id }).from(staffUsers)
        .where(and(eq(staffUsers.role, "ADMIN"), eq(staffUsers.active, true)));
      if (activeAdmins.length <= 1) return { kind: "lastAdmin" as const };
    }
    const [updated] = await tx.update(staffUsers).set({
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.role !== undefined ? { role: body.role as StaffRole } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      updatedAt: now,
    }).where(eq(staffUsers.id, existing.id)).returning();
    if (body.active === false) {
      await tx.update(sessions).set({ revokedAt: now })
        .where(and(eq(sessions.userId, existing.id), isNull(sessions.revokedAt)));
      await tx.update(credentialTokens).set({ consumedAt: now })
        .where(and(eq(credentialTokens.userId, existing.id), isNull(credentialTokens.consumedAt)));
    }
    return { kind: "updated" as const, user: updated };
  });
  if (result.kind === "notFound") {
    res.status(404).json({ error: "Staff account not found" });
    return;
  }
  if (result.kind === "selfDeactivate") {
    res.status(409).json({ error: "Administrators cannot deactivate their own account" });
    return;
  }
  if (result.kind === "selfDemote") {
    res.status(409).json({ error: "Administrators cannot remove their own administrator role" });
    return;
  }
  if (result.kind === "pending") {
    res.status(409).json({ error: "Staff must complete their invite before activation" });
    return;
  }
  if (result.kind === "demo") {
    res.status(409).json({ error: "Development demo accounts cannot be enabled in production" });
    return;
  }
  if (result.kind === "lastAdmin") {
    res.status(409).json({ error: "At least one active administrator is required" });
    return;
  }
  res.json(publicStaff(result.user));
});

router.get("/auth/me", requireAuth, (_req, res) => {
  res.json(res.locals["staff"]);
});

router.post("/auth/logout", requireAuth, async (_req, res) => {
  await db.update(sessions).set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, res.locals["sessionId"] as string), isNull(sessions.revokedAt)));
  res.clearCookie("aqsa_session");
  res.status(204).end();
});

export default router;