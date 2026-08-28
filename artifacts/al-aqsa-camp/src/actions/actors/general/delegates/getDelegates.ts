
import { DelegatesResponse } from "@/@types/actors/general/delegates/delegatesResponse.type";
import { AqsaAPI } from "@/services";

export interface getDelegatesProps {
    page?: number;
    limit?: number;
};

export const getDelegates = async ({ page = 1, limit = 15 }: getDelegatesProps): Promise<DelegatesResponse> => {

    try {
        const apiLimit = limit === -1 ? 100 : limit;
        const response = await AqsaAPI.get("/delegates", {
            params: {
                page, limit: apiLimit
            }
        }
        );

        if (response.data?.items) {
            const { items, pagination } = response.data;
            return {
                status: response.status,
                delegates: items.map((delegate: any) => ({
                    id: delegate.id,
                    name: delegate.name,
                    identity: "",
                    displaced_number: 0,
                    family_number: 0,
                    mobile_number: delegate.phone,
                    tents_number: 0,
                })),
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total_items: pagination.totalItems,
                    total_pages: pagination.totalPages,
                },
            };
        }

        throw new Error("بيانات المناديب غير متوفرة");

    } catch (error: any) {

        const errorMessage = error.response?.data?.error || error.message || "حدث خطأ أثناء جلب بيانات المناديب";

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            delegates: [],
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