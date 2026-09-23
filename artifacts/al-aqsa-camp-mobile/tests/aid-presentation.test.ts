import assert from 'node:assert/strict';
import test from 'node:test';
import type { Aid as ApiAid } from '@workspace/api-client-react';
import {
  formatReceivedDistributionCount,
  getReceivedDistributionCount,
  selectLatestAids,
} from '../lib/aidPresentation';
import { getAidSyncPresentation, retryAidList } from '../lib/aidSyncPresentation';

function makeApiAid(receivedDistributionCount?: number): ApiAid {
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

test('the API recipient count is rendered in the mobile aid card label', () => {
  const aidFromApi = makeApiAid(7);

  assert.equal(getReceivedDistributionCount(aidFromApi), 7);
  assert.equal(formatReceivedDistributionCount(aidFromApi), 'عدد المستلمين: 7');
});

test('a refreshed aid list replaces the cached recipient count', () => {
  const cachedAids = [makeApiAid(2)];
  const firstResponse = selectLatestAids(cachedAids, []);
  const refreshedResponse = selectLatestAids([makeApiAid(9)], firstResponse);

  assert.equal(formatReceivedDistributionCount(firstResponse[0]), 'عدد المستلمين: 2');
  assert.equal(formatReceivedDistributionCount(refreshedResponse[0]), 'عدد المستلمين: 9');
});

test('a failed retry keeps the cached recipient count and stale label', async () => {
  const cachedAids = [makeApiAid(2)];
  let requestCount = 0;

  await retryAidList(
    async (refresh) => {
      await assert.rejects(refresh, /aid service unavailable/);
      return false;
    },
    async () => {
      requestCount += 1;
      throw new Error('aid service unavailable');
    },
  );

  const aidsAfterFailedRetry = selectLatestAids(undefined, cachedAids);
  const presentationAfterFailedRetry = getAidSyncPresentation('error', 'تعذر تحديث بيانات المساعدات');

  assert.equal(requestCount, 1);
  assert.equal(formatReceivedDistributionCount(aidsAfterFailedRetry[0]), 'عدد المستلمين: 2');
  assert.equal(presentationAfterFailedRetry.recipientCountLabel, 'عدد المستلمين (آخر نسخة محفوظة دون اتصال)');
  assert.equal(presentationAfterFailedRetry.recipientCountIsCached, true);
  assert.match(presentationAfterFailedRetry.warningMessage ?? '', /آخر عدد محفوظ على الجهاز/);
});

test('a successful retry replaces the cached count and removes its stale label', async () => {
  const cachedAids = [makeApiAid(2)];
  let refreshedAids: ApiAid[] | undefined;

  await retryAidList(
    async (refresh) => {
      await refresh();
      return true;
    },
    async () => {
      refreshedAids = [makeApiAid(9)];
    },
  );

  const aidsAfterSuccessfulRetry = selectLatestAids(refreshedAids, cachedAids);
  const presentationAfterSuccessfulRetry = getAidSyncPresentation('synced', 'بيانات المساعدات متزامنة');

  assert.equal(formatReceivedDistributionCount(aidsAfterSuccessfulRetry[0]), 'عدد المستلمين: 9');
  assert.equal(presentationAfterSuccessfulRetry.recipientCountLabel, 'عدد المستلمين المتزامن');
  assert.equal(presentationAfterSuccessfulRetry.recipientCountIsCached, false);
  assert.equal(presentationAfterSuccessfulRetry.warningMessage, null);
});

test('a missing API recipient count defaults to zero', () => {
  assert.equal(getReceivedDistributionCount(makeApiAid()), 0);
  assert.equal(formatReceivedDistributionCount(makeApiAid()), 'عدد المستلمين: 0');
});