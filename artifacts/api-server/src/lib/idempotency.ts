import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, idempotencyKeys } from "@workspace/db";

type StoredResult<T> = { statusCode: number; responseBody: T };

/**
 * Executes a mutation and saves its response in the same transaction as the
 * resource write. A conflicting INSERT waits for that transaction, then reads
 * the completed response, so concurrent retries cannot create duplicates.
 */
export async function withIdempotency<T>(
  req: Request,
  res: Response,
  operation: string,
  work: (tx: any) => Promise<StoredResult<T>>,
  options: { required?: boolean } = {},
): Promise<StoredResult<T> | undefined> {
  const key = req.get("Idempotency-Key");
  if (!key && options.required === false) {
    return work(db);
  }
  if (!key || !key.trim() || key.length > 200) {
    res.status(400).json({
      error: "Idempotency-Key is required and must be 1 to 200 characters",
    });
    return undefined;
  }

  const userId = res.locals["staff"].id as string;
  return db.transaction(async (tx) => {
    const [claim] = await tx
      .insert(idempotencyKeys)
      .values({
        userId,
        operation,
        key,
        // These placeholders are not observable: the response write below
        // commits in the same transaction as this claim.
        statusCode: 0,
        responseBody: {},
      })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeys.id });

    if (claim) {
      const result = await work(tx);
      await tx
        .update(idempotencyKeys)
        .set({ statusCode: result.statusCode, responseBody: result.responseBody })
        .where(eq(idempotencyKeys.id, claim.id));
      return result;
    }

    const [stored] = await tx
      .select({
        statusCode: idempotencyKeys.statusCode,
        responseBody: idempotencyKeys.responseBody,
      })
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.operation, operation),
          eq(idempotencyKeys.key, key),
        ),
      )
      .limit(1);

    // A unique conflict can only occur for the key above. This guards against
    // unexpected data corruption without ever repeating the mutation.
    if (!stored || stored.statusCode === 0) {
      throw new Error("Idempotency record was not completed");
    }
    return { statusCode: stored.statusCode, responseBody: stored.responseBody as T };
  });
}