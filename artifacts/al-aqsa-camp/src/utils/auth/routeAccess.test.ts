import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@workspace/api-client-react';
import {
  canAccessActorPath,
  getLegacyActorRedirectTarget,
  navigateWithHistoryReplacement,
} from './routeAccess';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';

const users = {
  admin: { id: '10000000-0000-4000-8000-000000000001', role: Role.ADMIN },
  manager: { id: '10000000-0000-4000-8000-000000000002', role: Role.MANAGER },
  delegate: { id: '10000000-0000-4000-8000-000000000003', role: Role.DELEGATE },
  officer: { id: '10000000-0000-4000-8000-000000000004', role: Role.SECURITY_OFFICER },
  member: { id: '10000000-0000-4000-8000-000000000005', role: Role.SECURITY_MEMBER },
  displaced: { id: '10000000-0000-4000-8000-000000000006', role: 'displaced' },
} as const;

test('requires a session for every actor screen and limits staff management to admins', () => {
  assert.equal(canAccessActorPath('/actor/staff', users.manager), false);
  assert.equal(canAccessActorPath('/actor/staff', users.admin), true);
  assert.equal(canAccessActorPath('/actor/operations', users.member), true);
});

test('allows role owners to open only their own role profile', () => {
  assert.equal(canAccessActorPath('/actor/manager/228054100/complaints', users.manager), true);
  assert.equal(canAccessActorPath('/actor/manager/228054100/complaints', users.delegate), false);
  assert.equal(canAccessActorPath('/actor/delegates/228054099/complaints', users.delegate), true);
  assert.equal(canAccessActorPath('/actor/displaceds', users.member), false);
  assert.equal(canAccessActorPath('/actor/displaceds', users.delegate), true);
  assert.equal(canAccessActorPath('/actor/securities/228054097/complaints', users.member), true);
});

test('keeps security officer and security member as separate server roles', () => {
  assert.equal(canAccessActorPath('/actor/securities/228054098/complaints', users.officer), true);
  assert.equal(canAccessActorPath('/actor/securities/228054098/complaints', users.member), true);
  assert.equal(canAccessActorPath('/actor/securities/228054098/complaints', users.manager), true);
});

test('exposes the modern fixed workspace routes only to appropriate roles', () => {
  assert.equal(canAccessActorPath('/actor/profile', users.member), true);
  assert.equal(canAccessActorPath('/actor/families', users.delegate), true);
  assert.equal(canAccessActorPath('/actor/families', users.officer), false);
  assert.equal(canAccessActorPath('/actor/needs', users.officer), true);
  assert.equal(canAccessActorPath('/actor/aids', users.delegate), true);
  assert.equal(canAccessActorPath('/actor/tasks', users.member), true);
  assert.equal(canAccessActorPath('/actor/reports', users.member), true);
});

test('redirects every legacy staff profile, report, aid and task link with history replacement', () => {
  const redirects = [
    ['/actor/delegates/228054099/aids-management', GENERAL_ACTOR_ROUTES.AIDS],
    ['/actor/delegates/228054099/profile', GENERAL_ACTOR_ROUTES.PROFILE],
    ['/actor/delegates/228054099/reports', GENERAL_ACTOR_ROUTES.REPORTS],
    ['/actor/manager/228054100/aids-management', GENERAL_ACTOR_ROUTES.AIDS],
    ['/actor/manager/228054100/profile', GENERAL_ACTOR_ROUTES.PROFILE],
    ['/actor/manager/228054100/reports', GENERAL_ACTOR_ROUTES.REPORTS],
    ['/actor/securities/228054097/profile', GENERAL_ACTOR_ROUTES.PROFILE],
    ['/actor/securities/228054097/tasks', GENERAL_ACTOR_ROUTES.TASKS],
  ] as const;

  for (const [legacyPath, expectedTarget] of redirects) {
    const target = getLegacyActorRedirectTarget(legacyPath);
    assert.equal(target, expectedTarget);
    if (!target) assert.fail(`Expected a redirect target for ${legacyPath}`);

    const navigation = {
      target: '',
      options: undefined as { replace: true } | undefined,
    };
    navigateWithHistoryReplacement(target, (nextTarget, options) => {
      navigation.target = nextTarget;
      navigation.options = options;
    });

    assert.equal(navigation.target, expectedTarget);
    assert.deepEqual(navigation.options, { replace: true });
  }
});

test('keeps the family workspace isolated from legacy staff redirects', () => {
  assert.equal(getLegacyActorRedirectTarget('/actor/family'), null);
  assert.equal(getLegacyActorRedirectTarget('/actor/family/'), null);
  assert.equal(canAccessActorPath('/actor/family', users.displaced), true);

  for (const staffUser of [users.admin, users.manager, users.delegate, users.officer, users.member]) {
    assert.equal(
      canAccessActorPath('/actor/family', staffUser),
      false,
      `${staffUser.role} must not access the family workspace`,
    );
  }
});