import { createHash } from "node:crypto";

function canonicalRequestValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalRequestValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalRequestValue(entry)]),
    );
  }
  return value;
}

export function canonicalFamilyImportDigest(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalRequestValue(body))).digest("hex");
}

export function isMatchingFamilyImportReplay(body: unknown, expectedDigest: string): body is {
  inputDigest: string;
  importedCount: number;
} {
  if (!body || typeof body !== "object") return false;
  const stored = body as { inputDigest?: unknown; importedCount?: unknown };
  return stored.inputDigest === expectedDigest && typeof stored.importedCount === "number";
}