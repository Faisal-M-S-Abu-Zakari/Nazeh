import assert from 'node:assert/strict';
import test from 'node:test';
import type { Aid as ApiAid } from '@workspace/api-client-react';
import { selectLatestAids } from '../lib/aidPresentation';
import { getAidSyncPresentation, retryAidList } from '../lib/aidSyncPresentation';

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

test('a successful retry requests the aid list again and removes the cached warning', async () => {
  const cachedAids = [makeApiAid(4)];
  let requestCount = 0;
  let synchronizedRefreshCount = 0;
  let syncedAids: ApiAid[] | undefined;

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

  assert.equal(synchronizedRefreshCount, 1);
  assert.equal(requestCount, 1);
  assert.equal(aidsAfterRetry[0].receivedDistributionCount, 9);
  assert.equal(presentationAfterRetry.recipientCountIsCached, false);
  assert.equal(presentationAfterRetry.warningMessage, null);
});