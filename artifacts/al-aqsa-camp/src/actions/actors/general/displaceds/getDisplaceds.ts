
import { DisplacedsResponse } from "@/@types/actors/general/displaceds/displacesResponse.type";
import { AqsaAPI } from "@/services";
import { displacedsFilterValuesType } from "@/validation/actor/general/displaceds/displaceds-filter-form";
import { toLegacyDisplaced } from "@/services/legacyAdapters";
import type { DisplacedPersonPage } from "@workspace/api-client-react";

export interface getDisplacedsProps {
    page?: number;
    limit?: number;
    search?: string;
    filters?: displacedsFilterValuesType;
};

export const getDisplaceds = async ({ page = 1, limit = 7, search = '', filters }: getDisplacedsProps): Promise<DisplacedsResponse> => {

    try {
        const response = await AqsaAPI.get<DisplacedPersonPage>("/displaced-persons", { params: { page, limit } });

        if (response.data?.items) {
            const normalizedSearch = search.trim().toLocaleLowerCase();
            const displaceds = response.data.items
                .map(toLegacyDisplaced)
                .filter((person) => !normalizedSearch || person.name.toLocaleLowerCase().includes(normalizedSearch) || person.identity.includes(normalizedSearch));
            return {
                status: response.status, displaceds,
                pagination: { page: response.data.pagination.page, limit: response.data.pagination.limit, total_items: response.data.pagination.totalItems, total_pages: response.data.pagination.totalPages },
            };
        }

        throw new Error("بيانات النازحين غير متوفرة");

    } catch (error: any) {
        const errorMessage = error.response?.data?.error || error.message || "حدث خطأ أثناء جلب بيانات النازحين";
        return {
            status: error.response?.status || 500,
            message: errorMessage,
            displaceds: [],
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