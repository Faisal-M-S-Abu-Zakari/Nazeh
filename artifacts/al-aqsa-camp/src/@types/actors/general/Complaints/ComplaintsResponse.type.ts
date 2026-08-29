import { UserRank, UserType } from "@/constants/userTypes";
import { COMPLAINTS_STATUS } from "../../common-types/index.type";
import type { ComplaintStatus } from '@workspace/api-client-react';


export interface Complaint {
    id: string | number;
    apiId?: string;
    /** Present for records supplied by the synchronized operations API. */
    version?: number;
    date: string;
    sender: { id: Number, name: string, image: string, role: UserType | UserRank };
    receiver: { id: Number, name: string, image: string, role: UserType | UserRank };
    title: string;
    body: string;
    /** Synchronized records retain the server lifecycle state; old views may still supply legacy values. */
    status: ComplaintStatus | COMPLAINTS_STATUS;
}


export interface ComplaintResponse {
    status: number;
    message?: string;
    error?: string;
    complaints: Complaint[];
    pagination: {
        page: number;
        limit: number;
        total_items: number;
        total_pages: number;
    };
}
