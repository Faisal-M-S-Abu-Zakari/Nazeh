
import { AqsaAPI } from '@/services';
import { ComplaintResponse } from '@/@types/actors/general/Complaints/ComplaintsResponse.type';
import { UserRank, UserType } from '@/constants/userTypes';
import { COMPLAINTS_STATUS, COMPLAINTS_TABS } from '@/@types/actors/common-types/index.type';
import { toLegacyComplaint } from '@/services/legacyAdapters';
import type { ComplaintPage } from '@workspace/api-client-react';

export interface GetCommonComplaintsProps {
    page?: number;
    limit?: number;
    status?: COMPLAINTS_STATUS;
    date_range?: [string | null, string | null];
    search?: string;
    complaint_type: COMPLAINTS_TABS;
    actor_Id: number;
    role: UserType | UserRank
}

export async function getCommonComplaints({
    page = 1,
    limit = 5,
    status = COMPLAINTS_STATUS.ALL,
    date_range = [null, null],
    search = '',
    complaint_type,
    role,
    actor_Id,
}: GetCommonComplaintsProps): Promise<ComplaintResponse> {

    try {
        const response = await AqsaAPI.get<ComplaintPage>('/complaints', { params: { page, limit } });

        if (response.data?.items) {
            const normalizedSearch = search.trim().toLocaleLowerCase();
            const complaints = response.data.items
                .map((complaint) => toLegacyComplaint(complaint, actor_Id, role))
                .filter((complaint) => (
                    (status === COMPLAINTS_STATUS.ALL || complaint.status === status)
                    && (!normalizedSearch || complaint.title.toLocaleLowerCase().includes(normalizedSearch) || complaint.body.toLocaleLowerCase().includes(normalizedSearch))
                ));
            return {
                status: response.status,
                complaints,
                pagination: {
                    page: response.data.pagination.page,
                    limit: response.data.pagination.limit,
                    total_items: response.data.pagination.totalItems,
                    total_pages: response.data.pagination.totalPages,
                },
            };
        }

        throw new Error("بيانات الشكاوى غير متوفرة");

    } catch (error: any) {
        const errorMessage =
            error.response?.data?.error || error.message || 'حدث خطأ أثناء جلب الشكاوى';

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            complaints: [],
            pagination: { page: 1, limit: 0, total_items: 0, total_pages: 0 },
            error: errorMessage,
        };
    }

}
