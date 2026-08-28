
import { Aid } from "@/@types/actors/manager/aid-management/add-aid-management.types";
import { commonActionResponse } from "@/@types/common/action/commonActionResponse.type";
import { AqsaAPI } from "@/services";
import { toApiAidStatus } from "@/services/legacyAdapters";


export const updateAid = async (payload: Aid): Promise<commonActionResponse> => {
    try {
        const response = await AqsaAPI.patch(`/aids/${payload.id}`, {
            title: payload.aid_name,
            type: payload.aid_type,
            description: payload.aid_content,
            quantity: payload.existing_quantity,
            distributionDate: payload.delivery_date?.toISOString() ?? null,
            status: toApiAidStatus(payload.aid_status),
        });

        if (response.data) {
            return {
                status: response.status,
                message: "تم تعديل المساعدة بنجاح",
            };
        }

        return {
            status: 500,
            message: "حدث خطأ أثناء تعديل المساعدة",
            error: "حدث خطأ أثناء تعديل المساعدة",
        };


    } catch (error: any) {
        return {
            status: error.response?.status || 500,
            message: error.response?.data?.error || "حدث خطأ أثناء تعديل المساعدة",
            error: error.response?.data?.error || "حدث خطأ أثناء تعديل المساعدة",
        };
    }
};