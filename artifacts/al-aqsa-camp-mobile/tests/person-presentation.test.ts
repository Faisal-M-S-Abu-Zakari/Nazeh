import assert from 'node:assert/strict';
import test from 'node:test';
import type { Person as ApiPerson } from '@workspace/api-client-react';
import { selectLatestPeople } from '../lib/personPresentation';

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

test('keeps a newer cached person until the synchronized list catches up', () => {
  const cached = [makePerson('person-1', 2, 'الاسم المحدث')];
  const staleApi = [makePerson('person-1', 1, 'الاسم القديم')];

  assert.deepEqual(selectLatestPeople(staleApi, cached), cached);
});


test('uses the synchronized person and keeps the API list shape', () => {
  const cached = [
    makePerson('person-1', 1, 'الاسم القديم'),
    makePerson('removed', 1, 'سجل قديم'),
  ];
  const api = [makePerson('person-1', 2, 'الاسم المحدث')];

  assert.deepEqual(selectLatestPeople(api, cached), api);
});