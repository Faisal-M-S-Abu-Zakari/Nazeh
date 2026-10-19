export function formatTaskDueAt(value: string | null | undefined, timeZone?: string): string {
  if (!value) return 'غير محدد';

  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}
