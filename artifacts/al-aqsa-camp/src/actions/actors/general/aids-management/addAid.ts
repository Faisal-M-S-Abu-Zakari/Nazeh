import { Aid } from "@/@types/actors/manager/aid-management/add-aid-management.types";
import { commonActionResponse } from "@/@types/common/action/commonActionResponse.type";
import { AidType, createAid } from "@workspace/api-client-react";
import { TYPE_AIDS } from "@/@types/actors/common-types/index.type";

export const addAid = async (payload: Aid): Promise<commonActionResponse> => {
    const typeMap: Partial<Record<TYPE_AIDS, AidType>> = {
        [TYPE_AIDS.FOOD_AID]: AidType.FOOD,
        [TYPE_AIDS.MEDICAL_AID]: AidType.MEDICAL,
        [TYPE_AIDS.CLEANING_AID]: AidType.HYGIENE,
        [TYPE_AIDS.OTHER_AID]: AidType.OTHER,
        [TYPE_AIDS.CLOTHING_AIDS]: AidType.SHELTER,
        [TYPE_AIDS.EDUCATIONAL_AID]: AidType.OTHER,
        [TYPE_AIDS.FINANCIAL_AID]: AidType.OTHER,
    };
    try {
        // A submission must retain one unique key so a retried POST cannot create a duplicate aid.
        const idempotencyKey = `web-aid-${crypto.randomUUID()}`;
        await createAid({
            title: payload.aid_name,
            type: typeMap[payload.aid_type] ?? AidType.OTHER,
            quantity: Math.max(1, payload.existing_quantity || 1),
            unit: payload.aid_content || "حصة",
            location: payload.delivery_location,
            distributionDate: (payload.delivery_date ?? new Date()).toISOString().slice(0, 10),
            notes: payload.additional_notes || undefined,
        }, { headers: { "Idempotency-Key": idempotencyKey } });
        return { status: 200, message: "تم إضافة المساعدة بنجاح" };
    } catch (error: any) {
        return {
            status: error.status || 500,
            message: error.data?.error || error.message || "حدث خطأ أثناء إضافة المساعدة",
            error: error.data?.error || error.message || "حدث خطأ أثناء إضافة المساعدة",
        };
    }
};
