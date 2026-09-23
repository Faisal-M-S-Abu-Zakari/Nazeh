export const CAMP_SYNC_TIME_ZONE = 'Asia/Jerusalem';
export const CAMP_SYNC_TIME_ZONE_LABEL = 'بتوقيت القدس';
export const UNAVAILABLE_SYNC_TIME = 'آخر مزامنة ناجحة: غير متوفرة بعد';

type SyncTimeInput = string | number | Date | null | undefined;

const arabicDigits = (value: string) =>
  value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

export function formatLastSuccessfulSyncAt(value: SyncTimeInput): string {
  if (value === null || value === undefined || value === '') return UNAVAILABLE_SYNC_TIME;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE_SYNC_TIME;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAMP_SYNC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');

  if (!day || !month || !year || !hour || !minute) return UNAVAILABLE_SYNC_TIME;

  return `آخر مزامنة ناجحة: ${arabicDigits(`${day}/${month}/${year}`)}، ${arabicDigits(`${hour}:${minute}`)} (${CAMP_SYNC_TIME_ZONE_LABEL})`;
}