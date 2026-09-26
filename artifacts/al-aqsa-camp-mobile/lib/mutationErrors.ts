import { Alert } from 'react-native';

type ApiError = Error & { status?: number };
type ErrorPayload = { code?: unknown };

const genericMutationMessage = 'لم تُحفظ البيانات. حاول مرة أخرى.';

export function getErrorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? (error as ApiError).status
    : undefined;
}

export function isVersionConflict(error: unknown): boolean {
  return getErrorCode(error) === 'VERSION_CONFLICT' || getErrorStatus(error) === 409;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('data' in error)) return undefined;
  const payload = (error as ApiError & { data?: ErrorPayload | null }).data;
  return payload && typeof payload.code === 'string' ? payload.code : undefined;
}

export function getMutationErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);

  if (code === 'PERMISSION_DENIED' || status === 401 || status === 403) {
    return 'لا تملك الصلاحية لتنفيذ هذا الإجراء.';
  }
  if (code === 'AID_NOT_FOUND') {
    return 'لم تعد الحملة متاحة. حدّث القائمة ثم حاول مرة أخرى.';
  }
  if (status === 404) {
    return 'لم يعد السجل متاحاً. حدّث القائمة ثم حاول مرة أخرى.';
  }
  if (isVersionConflict(error)) {
    return 'تعارض في التحديث: تغيّرت البيانات منذ آخر تحميل. راجع أحدث نسخة قبل إعادة المحاولة.';
  }
  if (status === 400) {
    return 'تعذر حفظ التغيير. راجع البيانات وحاول مرة أخرى.';
  }
  if (status !== undefined && status >= 500) {
    return 'تعذر الاتصال بالخادم. لم تُحفظ البيانات؛ حاول مرة أخرى.';
  }
  return genericMutationMessage;
}

export async function showMutationError(error: unknown, refetch: () => Promise<unknown>) {
  if (isVersionConflict(error)) {
    try {
      await refetch();
    } catch {
      Alert.alert(
        'تعارض في التحديث',
        'تغيّرت البيانات منذ آخر تحميل، وتعذر تحميل أحدث نسخة. حدّث البيانات قبل إعادة المحاولة.',
      );
      return;
    }
    Alert.alert(
      'تعارض في التحديث',
      'تغيّرت البيانات منذ آخر تحميل. تم تحميل أحدث نسخة؛ راجعها قبل إعادة المحاولة.',
    );
    return;
  }
  Alert.alert('تعذر حفظ التغيير', getMutationErrorMessage(error));
}