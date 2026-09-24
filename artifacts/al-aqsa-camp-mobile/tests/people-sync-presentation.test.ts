import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Person as ApiPerson } from '@workspace/api-client-react';
import { formatLastSuccessfulSyncAt } from '../lib/syncTime';
import { selectLatestPeople } from '../lib/personPresentation';
import { getLastSuccessfulPeopleSyncAt, getPeopleSyncPresentation } from '../lib/peopleSyncPresentation';

const appContextSource = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');
const peopleScreenSource = readFileSync(new URL('../app/(tabs)/people.tsx', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../components/ui.tsx', import.meta.url), 'utf8');

function makePerson(id: string, version: number, fullName: string): ApiPerson {
  return {
    id,
    nationalId: `N-${id}`,
    fullName,
    gender: 'MALE',
    birthDate: '1988-04-12T00:00:00.000Z',
    phone: '0590000000',
    tentNumber: 'ت-1',
    familySize: 4,
    notes: null,
    version,
    createdById: null,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    archivedAt: null,
  };
}

test('the people list identifies a local cached copy while a server refresh is in progress', () => {
  const presentation = getPeopleSyncPresentation({
    isFetching: true,
    hasServerData: false,
    hasLocalData: true,
    hasError: false,
    isOffline: false,
  });

  assert.equal(presentation.state, 'syncing');
  assert.match(presentation.message, /نسخة محلية مؤقتة/);
});

test('a failed people-list request keeps cached records and clearly identifies their source', () => {
  const cachedPeople = [makePerson('person-1', 2, 'الاسم المحفوظ')];
  const visiblePeople = selectLatestPeople(undefined, cachedPeople);
  const presentation = getPeopleSyncPresentation({
    isFetching: false,
    hasServerData: false,
    hasLocalData: true,
    hasError: true,
    isOffline: true,
  });

  assert.deepEqual(visiblePeople, cachedPeople);
  assert.equal(presentation.state, 'offline');
  assert.match(presentation.message, /نسخة محلية مؤقتة/);
});

test('a successful retry marks the server list current and advances its saved sync time', () => {
  const priorSyncAt = '2026-09-23T08:00:00.000Z';
  const retryUpdatedAt = Date.parse('2026-09-24T08:10:00.000Z');
  const syncedAt = getLastSuccessfulPeopleSyncAt(priorSyncAt, retryUpdatedAt);
  const presentation = getPeopleSyncPresentation({
    isFetching: false,
    hasServerData: true,
    hasLocalData: true,
    hasError: false,
    isOffline: false,
  });

  assert.equal(presentation.state, 'synced');
  assert.equal(presentation.message, 'سجل النازحين متزامن مع خادم الفريق');
  assert.notEqual(syncedAt, priorSyncAt);
  assert.equal(
    formatLastSuccessfulSyncAt(syncedAt),
    'آخر مزامنة ناجحة: ٢٤/٠٩/٢٠٢٦، ١١:١٠ (بتوقيت القدس)',
  );

  const newerServerPerson = makePerson('person-1', 3, 'الاسم من الخادم');
  assert.deepEqual(
    selectLatestPeople([newerServerPerson], [makePerson('person-1', 2, 'الاسم المحفوظ')]),
    [newerServerPerson],
  );
});

test('the staff directory is wired to its own retry action and persisted sync timestamp', () => {
  assert.match(peopleScreenSource, /<SyncBanner scope="people" \/>/);
  assert.match(uiSource, /testID=\{scope === 'people' \? 'retry-people-sync'/);
  assert.match(uiSource, /people-last-successful-sync/);
  assert.match(appContextSource, /mobileAuthLifecycle\.synchronizedRefresh\(async \(\) => \{ await peopleQuery\.refetch\(\); \}\)/);
  assert.match(appContextSource, /lastPeopleSyncAt/);
  assert.match(appContextSource, /setHasLocalPeopleCache\(Array\.isArray\(stored\.cache\?\.people\)\)/);
});