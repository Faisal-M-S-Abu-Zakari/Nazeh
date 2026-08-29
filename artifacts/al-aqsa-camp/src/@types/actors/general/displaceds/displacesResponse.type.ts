export interface Displaced {
    id: number;
    apiId?: string;
    version?: number;
    name: string;
    identity: string;
    tent: string;
    family_number: number;
    mobile_number: string;
    delegate: HisDelegate;
}

export interface HisDelegate {
    id: number;
    name: string;
}

export interface DisplacedsResponse {
    status: number;
    message?: string;
    displaceds: Displaced[];
    error?: string;
    pagination: {
        page: number;
        limit: number;
        total_items: number;
        total_pages: number;
    };
}


export interface DisplacedsNamesResponse {
    status: number;
    message: string;
    displaceds_names: {
        id: number;
        name: string
    }[];
    error?: string;
}



export interface DisplacedsIdsResponse {
    status: number;
    message?: string;
    displaceds_Ids: number[];
    error?: string;
}