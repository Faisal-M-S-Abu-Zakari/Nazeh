import type { Response } from "express";
import type { ZodType } from "zod";

export function parseRequest<T>(schema: ZodType<T>, value: unknown, res: Response): T | undefined {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
    return undefined;
  }
  return parsed.data;
}