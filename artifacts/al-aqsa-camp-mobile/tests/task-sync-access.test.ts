import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canSyncStaffResource, isDisplacedAccount } from '../lib/syncAccess';

const appContextSource = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');

test('mobile sync permissions match the API role scopes', () => {
  const resources = ['aids', 'people', 'complaints', 'tasks'] as const;
  const allowedByRole: Record<string, string[]> = {
    ADMIN: [...resources],
    MANAGER: [...resources],
    DELEGATE: ['aids', 'people', 'complaints'],
    SECURITY_OFFICER: ['aids', 'complaints', 'tasks'],
    SECURITY_MEMBER: ['complaints', 'tasks'],
  };

  for (const [role, allowedResources] of Object.entries(allowedByRole)) {
    for (const resource of resources) {
      assert.equal(canSyncStaffResource(role, resource), allowedResources.includes(resource), `${role} ${resource} access`);
    }
  }

  for (const role of ['DISPLACED', 'displaced', 'unknown', null, undefined]) {
    for (const resource of resources) assert.equal(canSyncStaffResource(role, resource), false);
  }
});

test('displaced accounts are identified regardless of role casing', () => {
  assert.equal(isDisplacedAccount('displaced'), true);
  assert.equal(isDisplacedAccount('DISPLACED'), true);
  assert.equal(isDisplacedAccount('DELEGATE'), false);
});

test('manual refresh and aggregate state only include role-authorized sync queries', () => {
  for (const resource of ['aid', 'people', 'complaint', 'task']) {
    assert.match(appContextSource, new RegExp(`enabled: ${resource}SyncEnabled`));
    assert.match(appContextSource, new RegExp(`\\.\\.\\.\\(${resource}SyncEnabled \\? \\[${resource === 'aid' ? 'aids' : resource === 'complaint' ? 'complaints' : resource === 'task' ? 'tasks' : 'people'}Query\\.refetch\\(\\)\\] : \\[\\]\\)`));
  }
  assert.match(appContextSource, /familyEnabled \? \[familyProfileQuery\.refetch\(\), familyNeedsQuery\.refetch\(\)/);
  assert.match(appContextSource, /\.\.\.\(staffEnabled \? \[me\] : \[\]\)/);
  assert.match(appContextSource, /\.\.\.\(familyEnabled \? \[familyProfileQuery, familyNeedsQuery/);
});
