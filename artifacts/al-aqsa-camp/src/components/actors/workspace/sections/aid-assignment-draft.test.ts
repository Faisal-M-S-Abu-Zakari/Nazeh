import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AID_ASSIGNMENT_DRAFT_RETENTION_MS,
  DEFAULT_AID_ASSIGNMENT_DRAFT,
  clearAidAssignmentDraft,
  getAidAssignmentDraftStorageKey,
  hasAidAssignmentDraftContent,
  readAidAssignmentDraft,
  saveAidAssignmentDraft,
  type AidAssignmentDraft,
} from './aid-assignment-draft';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('scopes assignment drafts to the owner and aid record', () => {
  assert.equal(
    getAidAssignmentDraftStorageKey('MANAGER:42', 'aid/1'),
    'aqsa-aid-assignment-draft:MANAGER%3A42:aid%2F1',
  );
  assert.notEqual(
    getAidAssignmentDraftStorageKey('MANAGER:42', 'aid-1'),
    getAidAssignmentDraftStorageKey('MANAGER:42', 'aid-2'),
  );
  assert.notEqual(
    getAidAssignmentDraftStorageKey('MANAGER:42', 'aid-1'),
    getAidAssignmentDraftStorageKey('DELEGATE:42', 'aid-1'),
  );
  assert.equal(getAidAssignmentDraftStorageKey(null, 'aid-1'), null);
  assert.equal(getAidAssignmentDraftStorageKey('MANAGER:42', null), null);
});

test('saves, restores, and clears an assignment draft', () => {
  const storage = createStorage();
  const key = getAidAssignmentDraftStorageKey('MANAGER:42', 'aid-1')!;
  const draft: AidAssignmentDraft = {
    ...DEFAULT_AID_ASSIGNMENT_DRAFT,
    familyId: 'family-1',
    needId: 'need-1',
    quantity: 3,
  };

  assert.equal(saveAidAssignmentDraft(key, draft, storage, 1_000), true);
  assert.deepEqual(
    readAidAssignmentDraft(key, storage, 1_000 + AID_ASSIGNMENT_DRAFT_RETENTION_MS - 1),
    draft,
  );
  assert.deepEqual(JSON.parse(storage.getItem(key)!), { ...draft, lastModifiedAt: 1_000 });
  assert.equal(hasAidAssignmentDraftContent(draft), true);

  assert.equal(clearAidAssignmentDraft(key, storage), true);
  assert.equal(readAidAssignmentDraft(key, storage), null);
});

test('removes expired or malformed assignment drafts', () => {
  const storage = createStorage();
  const key = getAidAssignmentDraftStorageKey('MANAGER:42', 'aid-1')!;

  saveAidAssignmentDraft(key, { ...DEFAULT_AID_ASSIGNMENT_DRAFT, quantity: 2 }, storage, 1_000);
  assert.equal(
    readAidAssignmentDraft(key, storage, 1_000 + AID_ASSIGNMENT_DRAFT_RETENTION_MS),
    null,
  );
  assert.equal(storage.getItem(key), null);

  storage.setItem(key, JSON.stringify({ familyId: 'family-1', needId: 'need-1' }));
  assert.equal(readAidAssignmentDraft(key, storage), null);
  assert.equal(storage.getItem(key), null);
});