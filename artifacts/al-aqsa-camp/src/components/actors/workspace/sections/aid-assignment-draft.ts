export type AidAssignmentDraft = {
  familyId: string;
  needId: string;
  quantity: number | '';
};

export const DEFAULT_AID_ASSIGNMENT_DRAFT: AidAssignmentDraft = {
  familyId: '',
  needId: '',
  quantity: 1,
};

export const AID_ASSIGNMENT_DRAFT_RETENTION_MS = 24 * 60 * 60 * 1000;

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getLocalStorage(): DraftStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getAidAssignmentDraftStorageKey(
  ownerId: string | number | null | undefined,
  aidId: string | null | undefined,
): string | null {
  if (
    ownerId === null ||
    ownerId === undefined ||
    String(ownerId).trim() === '' ||
    !aidId ||
    aidId.trim() === ''
  ) {
    return null;
  }

  return `aqsa-aid-assignment-draft:${encodeURIComponent(String(ownerId))}:${encodeURIComponent(aidId)}`;
}

export function hasAidAssignmentDraftContent(draft: AidAssignmentDraft): boolean {
  return Boolean(
    draft.familyId ||
    draft.needId ||
    draft.quantity !== DEFAULT_AID_ASSIGNMENT_DRAFT.quantity,
  );
}

function parseAidAssignmentDraft(value: string | null, now: number): AidAssignmentDraft | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<AidAssignmentDraft> & {
      lastModifiedAt?: unknown;
    };
    const quantity = parsed.quantity;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.familyId !== 'string' ||
      typeof parsed.needId !== 'string' ||
      (quantity !== '' &&
        (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0)) ||
      typeof parsed.lastModifiedAt !== 'number' ||
      !Number.isFinite(parsed.lastModifiedAt) ||
      parsed.lastModifiedAt < 0 ||
      now - parsed.lastModifiedAt >= AID_ASSIGNMENT_DRAFT_RETENTION_MS
    ) {
      return null;
    }

    return {
      familyId: parsed.familyId,
      needId: parsed.needId,
      quantity,
    };
  } catch {
    return null;
  }
}

export function readAidAssignmentDraft(
  storageKey: string,
  storage: DraftStorage | null = getLocalStorage(),
  now = Date.now(),
): AidAssignmentDraft | null {
  if (!storage) return null;
  try {
    const rawValue = storage.getItem(storageKey);
    const draft = parseAidAssignmentDraft(rawValue, now);
    if (rawValue && !draft) storage.removeItem(storageKey);
    return draft;
  } catch {
    return null;
  }
}

export function saveAidAssignmentDraft(
  storageKey: string,
  draft: AidAssignmentDraft,
  storage: DraftStorage | null = getLocalStorage(),
  lastModifiedAt = Date.now(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, JSON.stringify({ ...draft, lastModifiedAt }));
    return true;
  } catch {
    return false;
  }
}

export function clearAidAssignmentDraft(
  storageKey: string,
  storage: DraftStorage | null = getLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}