export const FAMILY_LIST_LOAD_ERROR_TITLE = 'تعذر تحميل قائمة الأسر';
export const FAMILY_LIST_LOAD_ERROR_MESSAGE =
  'لم نتمكن من تحميل الأسر المستفيدة، لذلك لا يمكن تسجيل طلب احتياج الآن. أعد المحاولة قبل المتابعة.';

export function canSubmitNeed({
  familyId,
  familiesLoading,
  familiesError,
  familyCount,
}: {
  familyId: string | null;
  familiesLoading: boolean;
  familiesError: boolean;
  familyCount: number;
}): boolean {
  return Boolean(familyId) && !familiesLoading && !familiesError && familyCount > 0;
}