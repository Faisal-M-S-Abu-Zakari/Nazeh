
import { AqsaAPI } from '@/services';
import { DisplacedReceivedAidsResponse } from '@/@types/actors/displaced/received-aids/displacedReceivedAidsResponse.type';
import { DISPLACED_RECEIVED_AIDS_TABS, TYPE_AIDS } from '@/@types/actors/common-types/index.type';

interface FamilyAidDistributionRow {
    distribution: { id: string; status: 'ASSIGNED' | 'RECEIVED'; quantity: number; deliveredAt: string | null; createdAt: string };
    aid: { title: string; type: string; location: string; distributionDate: string; unit: string };
    need: { title: string };
    executedBy: { id: string; name: string; role: string };
}

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
        const response = await AqsaAPI.get<FamilyAidDistributionRow[]>('/family/me/aid-distributions');
        const allocationStatus = tab_type === DISPLACED_RECEIVED_AIDS_TABS.RECEIVED_AIDS ? 'RECEIVED'
            : tab_type === DISPLACED_RECEIVED_AIDS_TABS.PROVIDED_AIDS ? 'ASSIGNED' : undefined;
        const allItems = response.data.filter((item) => !allocationStatus || item.distribution.status === allocationStatus);
        const start = (page - 1) * limit;
        const items = allItems.slice(start, start + limit);
        const received_aids = items.map((item) => {
                return {
                    id: item.distribution.id,
                    tab_type: item.distribution.status === 'RECEIVED'
                        ? DISPLACED_RECEIVED_AIDS_TABS.RECEIVED_AIDS
                        : DISPLACED_RECEIVED_AIDS_TABS.PROVIDED_AIDS,
                    aid_name: item.aid.title,
                    aid_type: Object.values(TYPE_AIDS).includes(item.aid.type as TYPE_AIDS)
                        ? item.aid.type as TYPE_AIDS
                        : TYPE_AIDS.OTHER_AID,
                    aid_content: `${item.distribution.quantity} ${item.aid.unit}${item.need.title ? ` · ${item.need.title}` : ''}`,
                    delivery_location: item.aid.location,
                    delivery_date: new Date(item.aid.distributionDate ?? item.distribution.createdAt),
                    receipt_date: item.distribution.deliveredAt ? new Date(item.distribution.deliveredAt) : undefined,
                    aid_giver: {
                        giver_id: item.executedBy.id,
                        name: item.executedBy.name,
                        role: item.executedBy.role === 'DELEGATE'
                            ? ('DELEGATE' as const)
                            : ('MANAGER' as const),
                    },
                };
            });
        return {
            status: response.status,
            received_aids,
            pagination: {
                page,
                limit,
                total_items: allItems.length,
                total_pages: Math.max(1, Math.ceil(allItems.length / limit)),
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
