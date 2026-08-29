import { UserRank, UserType } from "@/constants/userTypes";
import { COMPLAINTS_STATUS } from "../../common-types/index.type";


export interface Complaint {
    id: number;
    apiId?: string;
    /** Present for records supplied by the synchronized operations API. */
    version?: number;
    date: string;
    sender: { id: Number, name: string, image: string, role: UserType | UserRank };
    receiver: { id: Number, name: string, image: string, role: UserType | UserRank };
    title: string;
    body: string;
    status: COMPLAINTS_STATUS;
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
