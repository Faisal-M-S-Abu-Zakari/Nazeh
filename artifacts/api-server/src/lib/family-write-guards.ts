import { inArray, sql } from "drizzle-orm";
import { familyMembersTable, shelterUnitsTable } from "@workspace/db";

export const FAMILY_NATIONAL_ID_INDEX = "family_members_national_id_normalized_unique";

export function normalizeNationalId(value: string): string {
  return value.replace(/[ \t\r\n\f\v]+/g, " ").replace(/^ +| +$/g, "").toLocaleLowerCase("en-US");
}

export function uniqueNormalizedNationalIds(values: string[]): string[] {
  return [...new Set(values.map(normalizeNationalId).filter(Boolean))];
}

export function sortedUniqueShelterIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

export async function lockShelterRows(tx: any, shelterIds: Array<string | null | undefined>) {
  const ids = sortedUniqueShelterIds(shelterIds);
  if (!ids.length) return [];
  return tx
    .select()
    .from(shelterUnitsTable)
    .where(inArray(shelterUnitsTable.id, ids))
    .orderBy(shelterUnitsTable.id)
    .for("update");
}

export async function hasExistingNationalIds(tx: any, values: string[]): Promise<boolean> {
  const ids = uniqueNormalizedNationalIds(values);
  if (!ids.length) return false;
  const normalizedColumn = sql<string>`lower(btrim(${familyMembersTable.nationalId}))`;
  const existing = await tx
    .select({ nationalId: normalizedColumn })
    .from(familyMembersTable)
    .where(inArray(normalizedColumn, ids))
    .limit(1);
  return existing.length > 0;
}

export function isNationalIdUniqueViolation(error: unknown): boolean {
  let candidate: unknown = error;
  for (let depth = 0; depth < 4 && candidate && typeof candidate === "object"; depth += 1) {
    const record = candidate as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (record.code === "23505" && record.constraint === FAMILY_NATIONAL_ID_INDEX) return true;
    candidate = record.cause;
  }
  return false;
}