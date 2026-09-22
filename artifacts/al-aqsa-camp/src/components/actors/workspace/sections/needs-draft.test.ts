import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_NEED_DRAFT,
  NEED_DRAFT_RETENTION_MS,
  clearNeedDraft,
  getNeedDraftStorageKey,
  hasNeedDraftContent,
  isNeedDraftStorageAvailable,
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

  assert.equal(saveNeedDraft(key, draft, storage, 1_000), true);
  assert.deepEqual(readNeedDraft(key, storage, 1_000 + NEED_DRAFT_RETENTION_MS - 1), draft);
  assert.deepEqual(JSON.parse(storage.getItem(key)!), { ...draft, lastModifiedAt: 1_000 });
  assert.equal(hasNeedDraftContent(draft), true);

  assert.equal(clearNeedDraft(key, storage), true);
  assert.equal(readNeedDraft(key, storage), null);
});

test('reports when browser storage cannot be used without throwing', () => {
  const blockedStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  const draft: NeedDraft = { ...DEFAULT_NEED_DRAFT, title: 'طلب' };
  const key = getNeedDraftStorageKey('MANAGER:42')!;

  assert.equal(isNeedDraftStorageAvailable(blockedStorage), false);
  assert.equal(saveNeedDraft(key, draft, blockedStorage), false);
  assert.equal(clearNeedDraft(key, blockedStorage), false);
});

test('removes drafts that have exceeded the retention period', () => {
  const storage = createStorage();
  const key = getNeedDraftStorageKey('MANAGER:42')!;
  const draft: NeedDraft = {
    ...DEFAULT_NEED_DRAFT,
    title: 'احتياج قديم',
    description: 'بيانات لا يجب أن تبقى على جهاز مشترك',
  };

  saveNeedDraft(key, draft, storage, 1_000);

  assert.equal(readNeedDraft(key, storage, 1_000 + NEED_DRAFT_RETENTION_MS), null);
  assert.equal(storage.getItem(key), null);
});

test('ignores malformed or incomplete stored values', () => {
  const storage = createStorage();
  const key = getNeedDraftStorageKey('MANAGER:42')!;

  storage.setItem(key, JSON.stringify({ familyId: 'family-1', title: 'طلب' }));
  assert.equal(readNeedDraft(key, storage), null);

  storage.setItem(key, '{not-json');
  assert.equal(readNeedDraft(key, storage), null);
  assert.equal(storage.getItem(key), null);
  assert.equal(hasNeedDraftContent(DEFAULT_NEED_DRAFT), false);
});

test('clears legacy drafts that do not have a modification timestamp', () => {
  const storage = createStorage();
  const key = getNeedDraftStorageKey('MANAGER:42')!;

  storage.setItem(key, JSON.stringify({ ...DEFAULT_NEED_DRAFT, title: 'مسودة قديمة' }));

  assert.equal(readNeedDraft(key, storage, 1_000), null);
  assert.equal(storage.getItem(key), null);
});