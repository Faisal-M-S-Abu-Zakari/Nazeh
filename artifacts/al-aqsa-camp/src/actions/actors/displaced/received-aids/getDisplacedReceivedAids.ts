
import { AqsaAPI } from '@/services';
import { DisplacedReceivedAidsResponse } from '@/@types/actors/displaced/received-aids/displacedReceivedAidsResponse.type';
import { DISPLACED_RECEIVED_AIDS_TABS, TYPE_AIDS } from '@/@types/actors/common-types/index.type';
import type { AidReceiptHistoryPage } from '@workspace/api-client-react';

export interface GetDisplacedReceivedAidsProps {
    displaced_Id: number;
    page?: number;
    limit?: number;
    tab_type?: DISPLACED_RECEIVED_AIDS_TABS;
}

export async function getDisplacedReceivedAids({
    displaced_Id,
    page = 1,
    limit = 10,
    tab_type,
}: GetDisplacedReceivedAidsProps): Promise<DisplacedReceivedAidsResponse> {
    try {
        const allocationStatus = tab_type === DISPLACED_RECEIVED_AIDS_TABS.RECEIVED_AIDS
            ? 'received'
            : tab_type === DISPLACED_RECEIVED_AIDS_TABS.PROVIDED_AIDS
                ? 'assigned'
                : undefined;
        const response = await AqsaAPI.get<AidReceiptHistoryPage>(`/displaced-persons/${displaced_Id}/aid-history`, {
            params: { page, limit, status: allocationStatus },
        });
        const { items, pagination } = response.data;
        const received_aids = items
            .filter((item) => !allocationStatus || item.status === allocationStatus)
            .map((item) => {
                return {
                    id: item.aidId,
                    tab_type: item.status === 'received'
                        ? DISPLACED_RECEIVED_AIDS_TABS.RECEIVED_AIDS
                        : DISPLACED_RECEIVED_AIDS_TABS.PROVIDED_AIDS,
                    aid_name: item.title,
                    aid_type: Object.values(TYPE_AIDS).includes(item.type as TYPE_AIDS)
                        ? item.type as TYPE_AIDS
                        : TYPE_AIDS.OTHER_AID,
                    aid_content: item.description ?? '',
                    delivery_location: item.distributionLocation ?? '',
                    delivery_date: new Date(item.distributionDate ?? item.receivedAt ?? Date.now()),
                    receipt_date: item.receivedAt ? new Date(item.receivedAt) : undefined,
                    aid_giver: {
                        giver_id: item.assignedBy.id,
                        name: item.assignedBy.name,
                        role: item.assignedBy.role === 'delegate'
                            ? ('DELEGATE' as const)
                            : ('MANAGER' as const),
                    },
                };
            });
        return {
            status: response.status,
            received_aids,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total_items: pagination.totalItems,
                total_pages: pagination.totalPages,
            },
        };
    } catch (error: any) {
        const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ أثناء جلب سجل المساعدات';
        return {
            status: error.response?.status || 500,
            message: errorMessage,
            error: errorMessage,
            received_aids: [],
            pagination: { page, limit, total_items: 0, total_pages: 0 },
        };
    }
}
