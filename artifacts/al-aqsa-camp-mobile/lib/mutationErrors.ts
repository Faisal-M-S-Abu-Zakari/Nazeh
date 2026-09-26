import { Alert } from 'react-native';

type ApiError = Error & { status?: number };
type ErrorPayload = { code?: unknown };

const genericMutationMessage = 'لم تُحفظ البيانات. حاول مرة أخرى.';

export function getErrorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? (error as ApiError).status
    : undefined;
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
  if (status === 409) {
    return 'تغيّر السجل من مستخدم آخر. راجع أحدث البيانات ثم حاول مرة أخرى.';
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
  if (getErrorStatus(error) === 409) {
    try {
      await refetch();
    } catch {
      // The conflict remains the primary error; the user can retry sync later.
    }
    Alert.alert(
      'تعارض في التحديث',
      'عدّل مستخدم آخر هذا السجل. تم تحميل أحدث نسخة؛ راجعها ثم أعد المحاولة.',
    );
    return;
  }
  Alert.alert('تعذر حفظ التغيير', getMutationErrorMessage(error));
}