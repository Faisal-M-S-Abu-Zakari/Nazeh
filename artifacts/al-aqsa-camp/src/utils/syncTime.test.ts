import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLastSuccessfulSyncAt } from './syncTime';

test('formats sync time in the camp timezone with Arabic-readable digits', () => {
  assert.equal(
    formatLastSuccessfulSyncAt('2026-09-23T08:00:00.000Z'),
    'آخر مزامنة ناجحة: ٢٣/٠٩/٢٠٢٦، ١١:٠٠ (بتوقيت القدس)',
  );
});

test('the web formatter is independent of the browser timezone', () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    const pacific = formatLastSuccessfulSyncAt('2026-09-23T08:00:00.000Z');
    process.env.TZ = 'Asia/Tokyo';
    const tokyo = formatLastSuccessfulSyncAt('2026-09-23T08:00:00.000Z');
    assert.equal(pacific, tokyo);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('keeps the unavailable state without a successful timestamp', () => {
  assert.equal(formatLastSuccessfulSyncAt(undefined), 'آخر مزامنة ناجحة: غير متوفرة بعد');
  assert.equal(formatLastSuccessfulSyncAt('not-a-date'), 'آخر مزامنة ناجحة: غير متوفرة بعد');
});