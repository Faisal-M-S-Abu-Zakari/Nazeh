import type { NeedInput } from '@workspace/api-client-react';

export type NeedDraft = Pick<NeedInput, 'familyId' | 'category' | 'priority' | 'title'> & {
  description: string;
};

export const DEFAULT_NEED_DRAFT: NeedDraft = {
  familyId: '',
  category: 'FOOD',
  priority: 'MEDIUM',
  title: '',
  description: '',
};

const NEED_CATEGORIES = ['FOOD', 'WATER', 'MEDICAL', 'SHELTER', 'HYGIENE', 'OTHER'] as const;
const NEED_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getLocalStorage(): DraftStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getNeedDraftStorageKey(ownerId: string | number | null | undefined): string | null {
  if (ownerId === null || ownerId === undefined || String(ownerId).trim() === '') return null;
  return `aqsa-need-draft:${encodeURIComponent(String(ownerId))}`;
}

export function hasNeedDraftContent(draft: NeedDraft): boolean {
  return Boolean(
    draft.familyId ||
    draft.title.trim() ||
    draft.description.trim() ||
    draft.category !== DEFAULT_NEED_DRAFT.category ||
    draft.priority !== DEFAULT_NEED_DRAFT.priority,
  );
}

function parseNeedDraft(value: string | null): NeedDraft | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<NeedDraft>;
    if (!parsed || typeof parsed !== 'object') return null;

    const category = parsed.category;
    const priority = parsed.priority;
    if (
      typeof parsed.familyId !== 'string' ||
      typeof parsed.title !== 'string' ||
      typeof parsed.description !== 'string' ||
      !NEED_CATEGORIES.includes(category as (typeof NEED_CATEGORIES)[number]) ||
      !NEED_PRIORITIES.includes(priority as (typeof NEED_PRIORITIES)[number])
    ) {
      return null;
    }

    return {
      familyId: parsed.familyId,
      category: category as NeedDraft['category'],
      priority: priority as NeedDraft['priority'],
      title: parsed.title,
      description: parsed.description,
    };
  } catch {
    return null;
  }
}

export function readNeedDraft(storageKey: string, storage: DraftStorage | null = getLocalStorage()): NeedDraft | null {
  if (!storage) return null;
  try {
    return parseNeedDraft(storage.getItem(storageKey));
  } catch {
    return null;
  }
}

export function saveNeedDraft(
  storageKey: string,
  draft: NeedDraft,
  storage: DraftStorage | null = getLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // A blocked or full browser storage must not interrupt form entry.
  }
}

export function clearNeedDraft(storageKey: string, storage: DraftStorage | null = getLocalStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // A blocked browser storage must not interrupt form reset or navigation.
  }
}