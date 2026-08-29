import { Alert } from 'react-native';

type ApiError = Error & { status?: number };

export function getErrorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? (error as ApiError).status
    : undefined;
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
  Alert.alert('تعذر حفظ التغيير', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
}