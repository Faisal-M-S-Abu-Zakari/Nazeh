import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@workspace/api-client-react';
import { canAccessActorPath } from './routeAccess';

const users = {
  admin: { id: '10000000-0000-4000-8000-000000000001', role: Role.ADMIN },
  manager: { id: '10000000-0000-4000-8000-000000000002', role: Role.MANAGER },
  delegate: { id: '10000000-0000-4000-8000-000000000003', role: Role.DELEGATE },
  officer: { id: '10000000-0000-4000-8000-000000000004', role: Role.SECURITY_OFFICER },
  member: { id: '10000000-0000-4000-8000-000000000005', role: Role.SECURITY_MEMBER },
} as const;

test('requires a session for every actor screen and limits staff management to admins', () => {
  assert.equal(canAccessActorPath('/actor/staff', users.manager), false);
  assert.equal(canAccessActorPath('/actor/staff', users.admin), true);
  assert.equal(canAccessActorPath('/actor/operations', users.member), true);
});

test('allows role owners to open only their own role profile', () => {
  assert.equal(canAccessActorPath('/actor/manager/228054100', users.manager), true);
  assert.equal(canAccessActorPath('/actor/manager/228054100', users.delegate), false);
  assert.equal(canAccessActorPath('/actor/delegates/228054099/profile', users.delegate), true);
  assert.equal(canAccessActorPath('/actor/delegates/228054100/profile', users.delegate), false);
  assert.equal(canAccessActorPath('/actor/displaceds', users.member), false);
  assert.equal(canAccessActorPath('/actor/displaceds', users.delegate), true);
  assert.equal(canAccessActorPath('/actor/securities/228054097/tasks', users.member), true);
  assert.equal(canAccessActorPath('/actor/securities/228054100/tasks', users.member), false);
});

test('keeps security officer and security member as separate server roles', () => {
  assert.equal(canAccessActorPath('/actor/securities/228054098/tasks', users.officer), true);
  assert.equal(canAccessActorPath('/actor/securities/228054098/tasks', users.member), false);
  assert.equal(canAccessActorPath('/actor/securities/228054098/tasks', users.manager), true);
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