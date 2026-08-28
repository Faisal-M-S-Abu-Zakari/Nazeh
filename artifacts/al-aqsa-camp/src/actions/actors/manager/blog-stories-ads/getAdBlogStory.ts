import { AqsaGuestAPI } from "@/services";
import { TYPE_WRITTEN_CONTENT } from "@/@types/actors/common-types/index.type";
import { AdBlogStoryResponse } from "@/@types/actors/manager/ads-blogs-stories/adsBlogsStoriesResponse.type";
import { toLegacyContent } from "@/services/legacyAdapters";
import type { ContentPost } from "@workspace/api-client-react";

export interface getAdBlogStoryProps {
    id: number
    type: TYPE_WRITTEN_CONTENT
}

export const getAdBlogStory = async ({ id, type }: getAdBlogStoryProps): Promise<AdBlogStoryResponse> => {

    try {
        const response = await AqsaGuestAPI.get<ContentPost>(`/content/${id}`);

        if (response.data?.id !== undefined) {
            return {
                status: response.status,
                ad_blog_story: toLegacyContent(response.data, type),
            };
        }

        throw new Error('بيانات المحتوى غير متوفرة');

    } catch (error: any) {
        const errorMessage =
            error.response?.data?.error || error.message || 'حدث خطأ أثناء جلب بيانات المحتوى';

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            ad_blog_story: {
                id: -1,
                title: '',
                brief: '',
                content: '',
                imgs: [],
                created_at: new Date(),
                updated_at: new Date(),
                type: type,
            },
            error: errorMessage,
        };
    }
};

/*
 const fakeResponse = fakeDisplacedReceivedAidsResponse({ displaced_Id, page, limit, tab_type })

    return new Promise((resolve) => setTimeout(() => resolve(fakeResponse), 1000));

    /////////////////////////////////////////////////////////////
    // FIXME: THIS IS THE REAL IMPLEMENTATION
    /////////////////////////////////////////////////////////////
    try {

        const response = await AqsaAPI.get<DisplacedReceivedAidsResponse>(`/displaceds/${displaced_Id}/received-aids`, {
            params: {
                page,
                limit,
                tab_type,
            }
        });

        if (response.data?.received_aids) {
            return response.data
        }

        throw new Error('بيانات المساعدات غير متوفرة');

    } catch (error: any) {
        const errorMessage =
            error.response?.data?.error || error.message || 'حدث خطأ أثناء جلب المساعدات';

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            received_aids: [],
            pagination: { page: 1, limit: 0, total_items: 0, total_pages: 0 },
            error: errorMessage,
        };
    } */