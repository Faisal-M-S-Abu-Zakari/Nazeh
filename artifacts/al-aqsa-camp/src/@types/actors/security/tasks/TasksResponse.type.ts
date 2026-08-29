import { TASKS_TABS } from "../../common-types/index.type";


export interface Task {
    id: number;
    apiId?: string;
    /** Present for records supplied by the synchronized operations API. */
    version?: number;
    dateTime: Date;
    title: string;
    body: string;
    security_men: number[]
    type: TASKS_TABS;
}

export interface TasksResponse {
    status: number;
    message?: string;
    tasks: Task[];
    pagination: {
        page: number;
        limit: number;
        total_items: number;
        total_pages: number;
    };
    error?: string;
}
