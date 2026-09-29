import bcrypt from "bcrypt";
import { inArray, sql } from "drizzle-orm";
import { db, staffUsers } from "@workspace/db";
import { z } from "zod";
import { isKnownDevelopmentDemo } from "../middlewares/auth";
import { passwordPolicyError } from "./security";

const PRIVILEGED_ROLES = ["ADMIN", "MANAGER"] as const;
const STAFF_MUTATION_LOCK = 81723041;

export type InitialManagerConfig = {
  email: string;
  password: string;
};

export type InitialManagerBootstrapResult = "created" | "already-exists" | "not-production";

export type InitialManagerRepository = {
  bootstrap(
    manager: { email: string; passwordHash: string } | null,
  ): Promise<
    "created" | "already-exists" | "no-privileged-manager" | "privileged-accounts-unavailable"
  >;
};

export function parseInitialManagerConfig(
  environment: NodeJS.ProcessEnv,
): InitialManagerConfig | undefined {
  const email = environment.INITIAL_MANAGER_EMAIL;
  const password = environment.INITIAL_MANAGER_PASSWORD;
  if (email === undefined && password === undefined) return undefined;
  if (email === undefined || password === undefined) {
    throw new Error(
      "INITIAL_MANAGER_EMAIL and INITIAL_MANAGER_PASSWORD must be configured together",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 320 || !z.email().safeParse(normalizedEmail).success) {
    throw new Error("INITIAL_MANAGER_EMAIL must contain a valid email address");
  }
  if (isKnownDevelopmentDemo("", normalizedEmail)) {
    throw new Error("INITIAL_MANAGER_EMAIL must not use the development-demo email domain");
  }
  const passwordError = passwordPolicyError(password);
  if (passwordError) {
    throw new Error(`INITIAL_MANAGER_PASSWORD is not acceptable: ${passwordError}`);
  }
  return { email: normalizedEmail, password };
}

export async function bootstrapInitialManager(
  environment: NodeJS.ProcessEnv = process.env,
  repository: InitialManagerRepository = databaseRepository,
  hashPassword: (password: string) => Promise<string> = (password) =>
    bcrypt.hash(password, 12),
): Promise<InitialManagerBootstrapResult> {
  if (environment.NODE_ENV !== "production") return "not-production";

  const config = parseInitialManagerConfig(environment);
  const manager = config
    ? { email: config.email, passwordHash: await hashPassword(config.password) }
    : null;
  const result = await repository.bootstrap(manager);

  if (result === "no-privileged-manager") {
    throw new Error(
      "No privileged staff account exists. Configure INITIAL_MANAGER_EMAIL and INITIAL_MANAGER_PASSWORD to create the initial manager.",
    );
  }
  if (result === "privileged-accounts-unavailable") {
    throw new Error(
      "Privileged staff accounts exist, but none is active and eligible for production login. Bootstrap will not change or replace them; restore access through your approved administrative recovery process.",
    );
  }
  return result;
}

const databaseRepository: InitialManagerRepository = {
  async bootstrap(manager) {
    return db.transaction(async (tx) => {
      // Use the same advisory lock as privileged staff mutations, serializing
      // every API process that can change manager state.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${STAFF_MUTATION_LOCK})`);
      const existing = await tx
        .select({
          id: staffUsers.id,
          email: staffUsers.email,
          active: staffUsers.active,
          isDevelopmentDemo: staffUsers.isDevelopmentDemo,
        })
        .from(staffUsers)
        .where(inArray(staffUsers.role, [...PRIVILEGED_ROLES]));
      if (
        existing.some((user) =>
          user.active &&
          !user.isDevelopmentDemo &&
          !isKnownDevelopmentDemo(user.id, user.email)
        )
      ) return "already-exists";
      if (existing.length > 0) return "privileged-accounts-unavailable";
      if (!manager) return "no-privileged-manager";

      await tx.insert(staffUsers).values({
        email: manager.email,
        name: "Initial Manager",
        role: "MANAGER",
        passwordHash: manager.passwordHash,
        active: true,
        passwordSetAt: new Date(),
        isDevelopmentDemo: false,
      });
      return "created";
    });
  },
};