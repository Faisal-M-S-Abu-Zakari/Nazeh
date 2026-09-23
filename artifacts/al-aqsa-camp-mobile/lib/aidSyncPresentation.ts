export type AidSyncState = 'syncing' | 'synced' | 'offline' | 'error';

export { formatLastSuccessfulSyncAt } from './syncTime';
import { formatLastSuccessfulSyncAt } from './syncTime';

export type AidSyncPresentation = {
  recipientCountLabel: string;
  recipientCountIsCached: boolean;
  warningTestID: string;
  retryTestID: string;
  warningTitle: string;
  warningMessage: string | null;
};

const cachedCountLabel = 'عدد المستلمين (آخر نسخة محفوظة دون اتصال)';
const syncingCountLabel = 'عدد المستلمين (جارٍ التحقق من الخادم)';
const syncedCountLabel = 'عدد المستلمين المتزامن';
const warningTitle = 'تعذر تحديث عدد المستلمين';
const warningTestID = 'aid-recipient-sync-warning';

export function getLastSuccessfulAidsSyncAt(current: string | null, dataUpdatedAt?: number): string | null {
  if (!dataUpdatedAt) return current;
  const updatedAt = new Date(dataUpdatedAt);
  return Number.isNaN(updatedAt.getTime()) ? current : updatedAt.toISOString();
}

export function getAidSyncPresentation(state: AidSyncState, message: string): AidSyncPresentation {
  const recipientCountIsCached = state === 'offline' || state === 'error';

  return {
    recipientCountLabel: recipientCountIsCached
      ? cachedCountLabel
      : state === 'syncing'
        ? syncingCountLabel
        : syncedCountLabel,
    recipientCountIsCached,
    warningTestID,
    retryTestID: `${warningTestID}-retry`,
    warningTitle,
    warningMessage: recipientCountIsCached
      ? `${message}. الرقم المعروض هو آخر عدد محفوظ على الجهاز، وليس بالضرورة العدد الحالي على الخادم.`
      : null,
  };
}

export async function retryAidList(
  synchronizedRefresh: (refresh: () => Promise<void>) => Promise<boolean>,
  refetch: () => Promise<unknown>,
): Promise<void> {
  await synchronizedRefresh(async () => {
    await refetch();
  });
}