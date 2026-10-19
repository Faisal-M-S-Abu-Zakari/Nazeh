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

  const date = new Date(year, month - 1, day);
  if (year < 100) date.setFullYear(year);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return { valid: false };

  return { valid: true, value: date.toISOString() };
}

export function getTaskDueDateInputValue(dueAt: string | null | undefined): string {
  if (!dueAt) return '';
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return '';

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTaskDueAtForUpdate(
  value: string,
  originalDueAt: string | null | undefined,
): TaskDueDateResult {
  if (originalDueAt && getTaskDueDateInputValue(originalDueAt) === value.trim()) {
    return { valid: true, value: originalDueAt };
  }
  return parseTaskDueDate(value);
}
