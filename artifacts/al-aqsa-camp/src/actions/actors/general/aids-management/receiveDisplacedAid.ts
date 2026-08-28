
import { commonActionResponse } from "@/@types/common/action/commonActionResponse.type";
import { USER_TYPE, UserType } from "@/constants/userTypes";
import { AqsaAPI } from "@/services";

export interface receiveDisplacedAidProps {
    receive_code: string;
    aid_Id: number;
    displaced_Id: number;
    actor_Id: number;
    role: Exclude<
        (typeof USER_TYPE)[UserType],
        typeof USER_TYPE.DISPLACED | typeof USER_TYPE.SECURITY
    >;
}

export const receiveDisplacedAid = async ({
    receive_code,
    aid_Id,
    displaced_Id,
    role,
    actor_Id,
}: receiveDisplacedAidProps): Promise<commonActionResponse> => {
    try {
        const response = await AqsaAPI.post(`/aids/${aid_Id}/receive`, {
            displacedPersonId: displaced_Id,
        });

        if (response.data) {
            return {
                status: 200,
                message: `تم تسليم المساعدة بنجاح`,
            };
        }

        throw new Error("حدث خطأ أثناء تسليم المساعدة");

    } catch (error: any) {
        const errorMessage =
            error.response?.data?.error || error.message || "حدث خطأ أثناء تسليم المساعدة";

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            error: errorMessage,
        };
    }
};
