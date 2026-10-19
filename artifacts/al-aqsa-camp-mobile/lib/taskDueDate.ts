export type TaskDueDateResult = { valid: true; value: string | null } | { valid: false };

export function parseTaskDueDate(value: string): TaskDueDateResult {
  const input = value.trim();
  if (!input) return { valid: true, value: null };

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return { valid: false };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) return { valid: false };

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return { valid: false };

  return { valid: true, value: date.toISOString() };
}
