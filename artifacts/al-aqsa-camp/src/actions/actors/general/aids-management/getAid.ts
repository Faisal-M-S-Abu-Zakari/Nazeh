

import { Aid, AidResponse } from '@/@types/actors/manager/aid-management/add-aid-management.types';
import { USER_RANK, USER_TYPE, UserRank } from '@/constants/userTypes';
import { AqsaAPI } from '@/services';
import { toLegacyAid } from '@/services/legacyAdapters';
import type { Aid as ApiAid } from '@workspace/api-client-react';

export interface getAidProps {
    aid_Id: number;
    actor_Id: number;
    role: Exclude<
        (typeof USER_RANK)[UserRank],
        | typeof USER_RANK.SECURITY_OFFICER
        | typeof USER_TYPE.DISPLACED
        | typeof USER_TYPE.SECURITY
    >;
};

export const getAid = async ({ aid_Id, actor_Id, role }: getAidProps): Promise<AidResponse> => {

    try {
        const response = await AqsaAPI.get<ApiAid>(`/aids/${aid_Id}`);

        if (response.data?.id !== undefined) {
            return { status: response.status, aid: toLegacyAid(response.data) };
        }

        throw new Error('بيانات المساعدة غير متوفرة');

    } catch (error: any) {

        const errorMessage =
            error.response?.data?.error || error.message || 'حدث خطأ أثناء جلب بيانات المساعدة';

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            aid: {} as Aid,
            error: errorMessage,
        };

    }
};

