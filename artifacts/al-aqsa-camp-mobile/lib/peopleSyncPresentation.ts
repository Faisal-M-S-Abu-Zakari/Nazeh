export type PeopleSyncState = 'syncing' | 'synced' | 'offline' | 'error';

type PeopleSyncInput = {
  isFetching: boolean;
  hasServerData: boolean;
  hasLocalData: boolean;
  hasError: boolean;
  isOffline: boolean;
};

export function getLastSuccessfulPeopleSyncAt(current: string | null, dataUpdatedAt?: number): string | null {
  if (!dataUpdatedAt) return current;
  const updatedAt = new Date(dataUpdatedAt);
  return Number.isNaN(updatedAt.getTime()) ? current : updatedAt.toISOString();
}

export function getPeopleSyncPresentation({ isFetching, hasServerData, hasLocalData, hasError, isOffline }: PeopleSyncInput): {
  state: PeopleSyncState;
  message: string;
} {
  const dataSource = hasServerData ? 'server' : hasLocalData ? 'local' : 'none';

  if (isFetching) {
    return {
      state: 'syncing',
      message: dataSource === 'local'
        ? 'جارٍ التحقق من سجل النازحين؛ المعروض الآن نسخة محلية مؤقتة'
        : dataSource === 'server'
          ? 'جارٍ تحديث سجل النازحين؛ المعروض آخر رد من الخادم'
          : 'جارٍ تحميل سجل النازحين من الخادم',
    };
  }

  if (hasError) {
    const problem = isOffline ? 'تعذر الاتصال بخادم سجل النازحين' : 'تعذر تحديث سجل النازحين';
    return {
      state: isOffline ? 'offline' : 'error',
      message: dataSource === 'local'
        ? `${problem} — المعروض الآن نسخة محلية مؤقتة`
        : dataSource === 'server'
          ? `${problem} — المعروض آخر بيانات تم تحميلها من الخادم`
          : `${problem} — لا توجد بيانات محلية محفوظة`,
    };
  }

  if (hasServerData) {
    return { state: 'synced', message: 'سجل النازحين متزامن مع خادم الفريق' };
  }

  return { state: 'syncing', message: 'بانتظار تحميل سجل النازحين من الخادم' };
}