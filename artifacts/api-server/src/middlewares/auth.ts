import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  sessions,
  sessionsTable,
  staffUsers,
  usersTable,
  type StaffRole,
  type UserRecord,
} from "@workspace/db";
import { hashSessionToken } from "../lib/security";

export type ApiRole = "admin" | "manager" | "delegate" | "displaced" | "security";
export const apiRole = (user: UserRecord): ApiRole =>
  user.role === "MANAGER"
    ? "manager"
    : user.role === "DELEGATE"
      ? "delegate"
      : user.role === "DISPLACED"
        ? "displaced"
        : "security";
export const hashToken = hashSessionToken;
export const newToken = () => randomBytes(32).toString("base64url");

declare global {
  namespace Express { interface Request { authUser?: UserRecord; sessionToken?: string } }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.aqsa_session;
  if (!token) { next(); return; }
  const tokenHash = hashToken(token);
  const [row] = await db.select({ session: sessionsTable, user: usersTable }).from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.tokenHash, tokenHash), isNull(sessionsTable.revokedAt), gt(sessionsTable.expiresAt, new Date())));
  if (row?.user.active) {
    req.authUser = row.user;
    req.sessionToken = token;
  } else if (row) {
    await db.update(sessionsTable).set({ revokedAt: new Date() })
      .where(and(eq(sessionsTable.id, row.session.id), isNull(sessionsTable.revokedAt)));
  }
  next();
}
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.authUser) {
    next();
    return;
  }
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [result] = await db
    .select({
      sessionId: sessions.id,
      id: staffUsers.id,
      email: staffUsers.email,
      name: staffUsers.name,
      role: staffUsers.role,
      profileImage: staffUsers.profileImage,
      active: staffUsers.active,
      passwordSetAt: staffUsers.passwordSetAt,
      isDevelopmentDemo: staffUsers.isDevelopmentDemo,
      createdAt: staffUsers.createdAt,
      updatedAt: staffUsers.updatedAt,
    })
    .from(sessions)
    .innerJoin(staffUsers, eq(sessions.userId, staffUsers.id))
    .where(and(
      eq(sessions.tokenHash, hashToken(token)),
      gt(sessions.expiresAt, new Date()),
      isNull(sessions.revokedAt),
      eq(staffUsers.active, true),
    ))
    .limit(1);

  if (
    !result ||
    (process.env.NODE_ENV === "production" &&
      (result.isDevelopmentDemo || isKnownDevelopmentDemo(result.id, result.email)))
  ) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  res.locals["staff"] = {
    id: result.id,
    email: result.email,
    name: result.name,
    role: result.role,
    profileImage: result.profileImage,
    active: result.active,
    passwordSet: Boolean(result.passwordSetAt),
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
  res.locals["sessionId"] = result.sessionId;
  next();
}

const DEMO_STAFF_IDS = new Set([
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
]);
export function isKnownDevelopmentDemo(id: string, email: string): boolean {
  return DEMO_STAFF_IDS.has(id) || email.toLowerCase().endsWith("@alaqsa.local");
}

export function allowRoles(...roles: StaffRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const staff = res.locals["staff"] as { role: StaffRole } | undefined;
    if (!staff || !roles.includes(staff.role)) {
      res.status(403).json({ error: "Insufficient permissions", code: "PERMISSION_DENIED" });
      return;
    }
    next();
  };
}
export const requireRoles = (...roles: ApiRole[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.authUser) { res.status(401).json({ error: "Authentication required" }); return; }
  if (!roles.includes(apiRole(req.authUser))) { res.status(403).json({ error: "Insufficient permissions" }); return; }
  next();
};

