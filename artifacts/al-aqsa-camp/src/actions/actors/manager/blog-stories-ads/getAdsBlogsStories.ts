import { AqsaGuestAPI } from "@/services";
import { TYPE_WRITTEN_CONTENT } from "@/@types/actors/common-types/index.type";
import { AdsBlogsStoriesResponse } from "@/@types/actors/manager/ads-blogs-stories/adsBlogsStoriesResponse.type";
import { toLegacyContent } from "@/services/legacyAdapters";
import type { ContentPostPage } from "@workspace/api-client-react";

export interface getAdsBlogsStoriesProps {
    page?: number;
    limit?: number;
    type: TYPE_WRITTEN_CONTENT;
}

export const getAdsBlogsStories = async ({ page = 1, limit = 5, type }: getAdsBlogsStoriesProps): Promise<AdsBlogsStoriesResponse> => {

    try {
        const response = await AqsaGuestAPI.get<ContentPostPage>('/content', { params: { page, limit } });

        if (response.data?.items) {
            return {
                status: response.status,
                ads_blogs_stories: response.data.items.map((post) => toLegacyContent(post, type)),
                pagination: { page: response.data.pagination.page, limit: response.data.pagination.limit, total_items: response.data.pagination.totalItems, total_pages: response.data.pagination.totalPages },
            };
        }

        throw new Error('بيانات المحتوى غير متوفرة');

    } catch (error: any) {
        const errorMessage =
            error.response?.data?.error || error.message || 'حدث خطأ أثناء جلب بيانات المحتوى';

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            ads_blogs_stories: [],
            pagination: { page: 1, limit: 0, total_items: 0, total_pages: 0 },
            error: errorMessage,
        };
    }
};
