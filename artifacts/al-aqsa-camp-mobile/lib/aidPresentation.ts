import type { Aid as ApiAid } from '@workspace/api-client-react';

export function selectLatestAids(apiAids: ApiAid[] | undefined, cachedAids: ApiAid[]): ApiAid[] {
  return apiAids ?? cachedAids;
}

export function getReceivedDistributionCount(aid: Pick<ApiAid, 'receivedDistributionCount'>): number {
  return aid.receivedDistributionCount ?? 0;
}

export function formatReceivedDistributionCount(aid: Pick<ApiAid, 'receivedDistributionCount'>): string {
  return `عدد المستلمين: ${getReceivedDistributionCount(aid)}`;
}