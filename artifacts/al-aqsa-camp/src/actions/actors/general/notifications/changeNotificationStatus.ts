
import { commonActionResponse } from "@/@types/common/action/commonActionResponse.type";
import { UserType } from "@/constants/userTypes";
import { AqsaAPI } from "@/services";

export interface changeNotificationStatusProps {
    actor_Id: number
    role: UserType
    notification_Id: number
}

export const changeNotificationStatus = async ({
    actor_Id,
    role,
    notification_Id,
}: changeNotificationStatusProps): Promise<commonActionResponse> => {
    try {
        const response = await AqsaAPI.patch(`/notifications/${notification_Id}/read`, { read: true });

        if (response.data) {
            return {
                status: 200,
                message: "تم تغيير حالة الاشعار بنجاح"
            };
        }

        throw new Error("حدث خطأ أثناء تغيير حالة الاشعار");

    } catch (error: any) {
        const errorMessage =
            error.response?.data?.error || error.message || "حدث خطأ أثناء تغيير حالة الاشعار";
        return {
            status: error.response?.status || 500,
            message: errorMessage,
            error: errorMessage,
        };
    }
};