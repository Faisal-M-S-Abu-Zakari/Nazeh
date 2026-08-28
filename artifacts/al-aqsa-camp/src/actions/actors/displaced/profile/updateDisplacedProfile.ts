
import { DisplacedProfile, DisplacedProfileResponse } from "@/@types/actors/displaced/profile/displacedProfileResponse.type";
import { AqsaAPI } from "@/services";
import { DisplacedProfileSchemaType } from "@/validation/actor/displaceds/profile/displaced-profile-schema";
import { toLegacyDisplacedProfile } from "@/services/legacyAdapters";
import type { DisplacedPerson } from "@workspace/api-client-react";
import { AGES } from "@/@types/actors/common-types/index.type";

export interface UpdateDisplacedProfileProps {
    displaced_Id: number;
    payload: DisplacedProfileSchemaType;
}

export const updateDisplacedProfile = async ({
    displaced_Id,
    payload,
}: UpdateDisplacedProfileProps): Promise<DisplacedProfileResponse> => {
    try {
        const response = await AqsaAPI.patch<DisplacedPerson>(`/displaced-persons/${displaced_Id}`, {
            name: payload.name, phone: payload.phone_number, nationalId: payload.identity,
            familySize: payload.social_status.total_family_members, location: payload.original_address,
        });
        if (response.data?.id !== undefined) {
            return {
                status: response.status,
                message: "تم تحديث الملف الشخصي للنازح بنجاح",
                user: {
                    ...toLegacyDisplacedProfile(response.data),
                    ...payload,
                    id: response.data.id,
                    profile_image: payload.profile_image ?? "",
                    alternative_phone_number: payload.alternative_phone_number ?? undefined,
                    additional_notes: payload.additional_notes ?? "",
                    social_status: {
                        ...payload.social_status,
                        age_groups: Object.fromEntries(Object.values(AGES).map((age) => [age, payload.social_status.age_groups[age] ?? 0])) as Record<AGES, number>,
                    },
                },
            };
        }

        throw new Error("فشل في تحديث الملف الشخصي");

    } catch (error: any) {
        const errorMessage =
            error.response?.data?.error || error.message || "حدث خطأ أثناء تحديث الملف الشخصي للنازح";

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            user: {} as DisplacedProfile,
            error: errorMessage,
        };
    }
};
