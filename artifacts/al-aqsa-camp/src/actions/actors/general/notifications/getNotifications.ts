
import { NotificationsResponse } from "@/@types/actors/general/notification/notificationResponse.type";
import { UserType } from "@/constants/userTypes";
import { AqsaAPI } from "@/services";
import { toLegacyNotification } from "@/services/legacyAdapters";
import type { NotificationPage } from "@workspace/api-client-react";

export interface getNotificationsProps {
    actor_Id: number
    role: UserType
    page: number;
    limit: number;
};

export const getNotifications = async ({ page = 1, limit = 7, actor_Id, role }: getNotificationsProps): Promise<NotificationsResponse> => {

    try {
        const response = await AqsaAPI.get<NotificationPage>('/notifications', { params: { page, limit } });

        if (response.data?.items) {
            return {
                status: response.status,
                message: "تم جلب الاشعارات بنجاح",
                notifications: response.data.items.map(toLegacyNotification),
                pagination: {
                    page: response.data.pagination.page,
                    limit: response.data.pagination.limit,
                    total_items: response.data.pagination.totalItems,
                    total_pages: response.data.pagination.totalPages,
                }
            };
        }

        throw new Error("بيانات الاشعارات غير متوفرة");

    } catch (error: any) {
        const errorMessage = error.response?.data?.error || error.message || "حدث خطأ أثناء جلب الاشعارات";
        return {
            status: error.response?.status || 500,
            message: errorMessage,
            notifications: [],
            pagination: {
                page: 1,
                limit: 0,
                total_items: 0,
                total_pages: 0,
            },
            error: errorMessage,
        };
    }
};