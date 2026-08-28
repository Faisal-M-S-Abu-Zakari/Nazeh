
import { Task, TasksResponse } from "@/@types/actors/security/tasks/TasksResponse.type";
import { AqsaAPI } from "@/services";
import { TASKS_TABS } from "@/@types/actors/common-types/index.type";
import { toLegacyTask } from "@/services/legacyAdapters";
import type { SecurityTaskPage } from "@workspace/api-client-react";

interface GetSecurityTasksProps {
    page?: number;
    limit?: number;
    task_type: TASKS_TABS;
    security_Id: number;
}

export async function getSecurityTasks({
    page = 1,
    limit = 5,
    security_Id,
    task_type,
}: GetSecurityTasksProps): Promise<TasksResponse> {

    try {
        const response = await AqsaAPI.get<SecurityTaskPage>('/security-tasks', { params: { page, limit } });

        if (response.data?.items) {
            return {
                status: response.status,
                tasks: response.data.items.map(toLegacyTask).filter((task) => task.type === task_type),
                pagination: {
                    page: response.data.pagination.page,
                    limit: response.data.pagination.limit,
                    total_items: response.data.pagination.totalItems,
                    total_pages: response.data.pagination.totalPages,
                },
            };
        }

        throw new Error('بيانات المهام غير متوفرة');

    } catch (error: any) {
        const errorMessage =
            error.response?.data?.error || error.message || 'حدث خطأ أثناء جلب المهام';

        return {
            status: error.response?.status || 500,
            message: errorMessage,
            tasks: [],
            pagination: { page: 1, limit: 0, total_items: 0, total_pages: 0 },
            error: errorMessage,
        };
    }
}
