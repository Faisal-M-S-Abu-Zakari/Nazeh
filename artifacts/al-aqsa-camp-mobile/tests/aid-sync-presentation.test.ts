import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Aid as ApiAid } from '@workspace/api-client-react';
import { selectLatestAids } from '../lib/aidPresentation';
import {
  formatLastSuccessfulSyncAt,
  getAidSyncPresentation,
  getLastSuccessfulAidsSyncAt,
  retryAidList,
} from '../lib/aidSyncPresentation';

const aidDetailScreenSource = readFileSync(new URL('../app/aid/[id].tsx', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../components/ui.tsx', import.meta.url), 'utf8');

function makeApiAid(receivedDistributionCount: number): ApiAid {
  return {
    id: 'aid-1',
    title: 'سلة غذائية',
    type: 'FOOD',
    quantity: 10,
    unit: 'سلة',
    location: 'المخيم',
    distributionDate: '2099-01-01T00:00:00.000Z',
    createdById: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    receivedDistributionCount,
  };
}

test('a failed aid-list sync labels the cached count and exposes the warning retry controls', () => {
  const cachedAids = [makeApiAid(4)];
  const aidsAfterFailedRequest = selectLatestAids(undefined, cachedAids);
  const presentation = getAidSyncPresentation('offline', 'تعذر الاتصال بخادم المساعدات');

  assert.equal(aidsAfterFailedRequest[0].receivedDistributionCount, 4);
  assert.equal(presentation.recipientCountIsCached, true);
  assert.equal(presentation.recipientCountLabel, 'عدد المستلمين (آخر نسخة محفوظة دون اتصال)');
  assert.equal(presentation.warningTestID, 'aid-recipient-sync-warning');
  assert.equal(presentation.retryTestID, 'aid-recipient-sync-warning-retry');
  assert.equal(presentation.warningTitle, 'تعذر تحديث عدد المستلمين');
  assert.match(presentation.warningMessage ?? '', /آخر عدد محفوظ على الجهاز/);
});

test('a successful retry requests the aid list again, removes the cached warning, and displays its sync time', async () => {
  const cachedAids = [makeApiAid(4)];
  let requestCount = 0;
  let synchronizedRefreshCount = 0;
  let syncedAids: ApiAid[] | undefined;
  const successfulSyncAt = Date.parse('2026-09-23T08:10:00.000Z');

  await retryAidList(
    async (refresh) => {
      synchronizedRefreshCount += 1;
      await refresh();
      return true;
    },
    async () => {
      requestCount += 1;
      syncedAids = [makeApiAid(9)];
    },
  );

  const aidsAfterRetry = selectLatestAids(syncedAids, cachedAids);
  const presentationAfterRetry = getAidSyncPresentation('synced', 'بيانات المساعدات متزامنة');
  const lastSyncedAt = getLastSuccessfulAidsSyncAt(null, successfulSyncAt);

  assert.equal(synchronizedRefreshCount, 1);
  assert.equal(requestCount, 1);
  assert.equal(aidsAfterRetry[0].receivedDistributionCount, 9);
  assert.equal(presentationAfterRetry.recipientCountIsCached, false);
  assert.equal(presentationAfterRetry.warningMessage, null);
  assert.equal(
    formatLastSuccessfulSyncAt(lastSyncedAt),
    'آخر مزامنة ناجحة: ٢٣/٠٩/٢٠٢٦، ١١:١٠ (بتوقيت القدس)',
  );
});

test('a failed retry keeps the last successful sync time until a later success', () => {
  const firstSuccessAt = Date.parse('2026-09-23T08:00:00.000Z');
  const laterSuccessAt = Date.parse('2026-09-23T08:05:00.000Z');
  let lastSyncedAt = getLastSuccessfulAidsSyncAt(null, firstSuccessAt);
  let successfulTimestampUpdates = 1;

  lastSyncedAt = getLastSuccessfulAidsSyncAt(lastSyncedAt, undefined);
  assert.equal(lastSyncedAt, '2026-09-23T08:00:00.000Z');

  const nextLastSyncedAt = getLastSuccessfulAidsSyncAt(lastSyncedAt, laterSuccessAt);
  if (nextLastSyncedAt !== lastSyncedAt) successfulTimestampUpdates += 1;
  lastSyncedAt = nextLastSyncedAt;

  assert.equal(lastSyncedAt, '2026-09-23T08:05:00.000Z');
  assert.equal(successfulTimestampUpdates, 2);
  assert.equal(getLastSuccessfulAidsSyncAt(lastSyncedAt, laterSuccessAt), lastSyncedAt);
});

test('before the first successful sync, the unavailable timestamp keeps the stale warning and retry control', () => {
  const warning = getAidSyncPresentation('offline', 'تعذر الاتصال بخادم المساعدات');

  assert.equal(formatLastSuccessfulSyncAt(null), 'آخر مزامنة ناجحة: غير متوفرة بعد');
  assert.equal(warning.recipientCountIsCached, true);
  assert.equal(warning.warningTestID, 'aid-recipient-sync-warning');
  assert.equal(warning.retryTestID, 'aid-recipient-sync-warning-retry');
  assert.equal(warning.warningTitle, 'تعذر تحديث عدد المستلمين');
  assert.match(warning.warningMessage ?? '', /آخر عدد محفوظ على الجهاز/);
});

test('the campaigns cached-version warning displays the last successful sync time', () => {
  const lastSyncedAt = '2026-09-23T08:00:00.000Z';

  assert.equal(
    formatLastSuccessfulSyncAt(lastSyncedAt),
    'آخر مزامنة ناجحة: ٢٣/٠٩/٢٠٢٦، ١١:٠٠ (بتوقيت القدس)',
  );
});

test('sync time stays identical when the device timezone changes', () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    const pacific = formatLastSuccessfulSyncAt('2026-09-23T08:00:00.000Z');
    process.env.TZ = 'Asia/Tokyo';
    const tokyo = formatLastSuccessfulSyncAt('2026-09-23T08:00:00.000Z');
    assert.equal(pacific, tokyo);
    assert.equal(pacific, 'آخر مزامنة ناجحة: ٢٣/٠٩/٢٠٢٦، ١١:٠٠ (بتوقيت القدس)');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('sync time remains unavailable until a successful timestamp exists', () => {
  assert.equal(formatLastSuccessfulSyncAt(null), 'آخر مزامنة ناجحة: غير متوفرة بعد');
  assert.equal(formatLastSuccessfulSyncAt('not-a-date'), 'آخر مزامنة ناجحة: غير متوفرة بعد');
});

test('aid details render the unavailable sync state without removing cached-data controls', () => {
  assert.match(
    aidDetailScreenSource,
    /<SyncTimestamp testID="aid-last-successful-sync" lastSyncedAt=\{lastAidsSyncAt\} \/>/,
  );
  assert.match(
    uiSource,
    /<Text testID=\{testID\}[^>]*>\s*\{formatLastSuccessfulSyncAt\(lastSyncedAt\)\}\s*<\/Text>/,
  );
  assert.match(uiSource, /syncTimestamp: \{ flexShrink: 1,/);
  assert.match(
    aidDetailScreenSource,
    /recipientSync\.recipientCountIsCached \? \(\s*<DataFreshnessNotice[\s\S]*?onRetry=\{\(\) => void retryAids\(\)\}/,
  );
  assert.equal(formatLastSuccessfulSyncAt(null), 'آخر مزامنة ناجحة: غير متوفرة بعد');
});
