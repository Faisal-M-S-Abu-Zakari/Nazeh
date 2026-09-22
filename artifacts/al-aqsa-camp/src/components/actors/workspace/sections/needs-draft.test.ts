import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_NEED_DRAFT,
  clearNeedDraft,
  getNeedDraftStorageKey,
  hasNeedDraftContent,
  readNeedDraft,
  saveNeedDraft,
  type NeedDraft,
} from './needs-draft';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('scopes need drafts to the authenticated owner', () => {
  assert.equal(getNeedDraftStorageKey('MANAGER:42'), 'aqsa-need-draft:MANAGER%3A42');
  assert.notEqual(getNeedDraftStorageKey('MANAGER:42'), getNeedDraftStorageKey('DELEGATE:42'));
  assert.notEqual(getNeedDraftStorageKey('MANAGER:42'), getNeedDraftStorageKey('MANAGER:43'));
  assert.equal(getNeedDraftStorageKey(null), null);
});

test('saves, restores, and clears a valid need draft', () => {
  const storage = createStorage();
  const key = getNeedDraftStorageKey('MANAGER:42')!;
  const draft: NeedDraft = {
    ...DEFAULT_NEED_DRAFT,
    familyId: 'family-1',
    category: 'MEDICAL',
    title: 'أدوية',
    description: 'جرعة أسبوعية',
  };

  saveNeedDraft(key, draft, storage);
  assert.deepEqual(readNeedDraft(key, storage), draft);
  assert.equal(hasNeedDraftContent(draft), true);

  clearNeedDraft(key, storage);
  assert.equal(readNeedDraft(key, storage), null);
});

test('ignores malformed or incomplete stored values', () => {
  const storage = createStorage();
  const key = getNeedDraftStorageKey('MANAGER:42')!;

  storage.setItem(key, JSON.stringify({ familyId: 'family-1', title: 'طلب' }));
  assert.equal(readNeedDraft(key, storage), null);

  storage.setItem(key, '{not-json');
  assert.equal(readNeedDraft(key, storage), null);
  assert.equal(hasNeedDraftContent(DEFAULT_NEED_DRAFT), false);
});