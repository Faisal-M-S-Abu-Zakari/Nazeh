import { DISPLACED_RECEIVED_AIDS_TABS, TYPE_AIDS } from "../../common-types/index.type";

export interface DisplacedReceivedAidsResponse {
    status: number;
    message?: string;
    error?: string;
    received_aids: DisplacedReceivedAid[];
    pagination: {
        page: number;
        limit: number;
        total_items: number;
        total_pages: number;
    };
}

export interface DisplacedReceivedAid {
    id: string | number;
    tab_type: DISPLACED_RECEIVED_AIDS_TABS;

    aid_name: string;
    aid_type: TYPE_AIDS;
    aid_content: string;
    delivery_location: string;

    delivery_date: Date;
    receipt_date?: Date;

    aid_giver: {
        giver_id: string | number;
        name: string;
        role: "DELEGATE" | "MANAGER";
        // role: Exclude<
        //     (typeof USER_TYPE)[UserType],
        //     typeof USER_TYPE.DISPLACED | typeof USER_TYPE.SECURITY
        // >;
    };
}
