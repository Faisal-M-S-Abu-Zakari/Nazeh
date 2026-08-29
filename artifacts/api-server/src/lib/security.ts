import {
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { logger } from "./logger";
const scrypt = promisify(nodeScrypt);
const configuredSecret = process.env.SESSION_SECRET;
if (!configuredSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production");
}
/** Development-only entropy namespace; production deployments must configure it. */
export const sessionSecret = configuredSecret ?? randomBytes(32).toString("hex");
if (!configuredSecret) logger.warn("Using ephemeral development-only SESSION_SECRET");

export function hashSessionToken(token: string): string {
  return createHmac("sha256", sessionSecret).update(token).digest("hex");
}
/** Credential tokens use a separate namespace from session tokens. */
export function hashCredentialToken(token: string): string {
  return createHmac("sha256", sessionSecret)
    .update(`credential:${token}`)
    .digest("hex");
}

export function passwordPolicyError(password: string): string | undefined {
  if (password.length < 12 || password.length > 128) {
    return "Password must be between 12 and 128 characters";
  }
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return "Password must include uppercase, lowercase, number, and symbol characters";
  }
  return undefined;
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${Buffer.from((await scrypt(password, salt, 64)) as ArrayBuffer).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, value] = stored.split(":");
  if (!salt || !value) return false;
  const actual = Buffer.from((await scrypt(password, salt, 64)) as ArrayBuffer);
  const expected = Buffer.from(value, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}