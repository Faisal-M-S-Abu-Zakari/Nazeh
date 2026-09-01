import {
    DELEGATE_PORTIONS,
    DISTRIBUTION_MECHANISM,
    DISTRIBUTION_METHOD,
    QUANTITY_AVAILABILITY,
    TYPE_AIDS,
    TYPE_GROUP_AIDS
} from '../../common-types/index.type';

//////////////////////////////////////////////////////
// CATEGORY RANGE
//////////////////////////////////////////////////////

export interface CategoryRangeType {
    id: string;
    label: string;
    min: number;
    max: number | null;
    is_default?: boolean;
    portion?: number;
}

//////////////////////////////////////////////////////
// DELEGATE PORTIONS
//////////////////////////////////////////////////////

export interface SelectedDelegatePortion {
    delegate_Id: number;
    portion: number;
}

//////////////////////////////////////////////////////
// BASE AID FORM TYPES
//////////////////////////////////////////////////////

export interface BaseAidForm {
    aid_name: string;
    aid_type: TYPE_AIDS;
    aid_content: string;
    delivery_date: Date | null;
    delivery_location: string;
    security_required: boolean;
    quantity_availability: QUANTITY_AVAILABILITY;
    existing_quantity: number;
    displaced_single_portion: number;
    selected_categories: CategoryRangeType[];
    distribution_method: DISTRIBUTION_METHOD;
    additional_notes: string;
}

//////////////////////////////////////////////////////
// CONDITIONAL TYPES (Discriminated Unions)
//////////////////////////////////////////////////////

export interface DelegateAidForm extends BaseAidForm {
    distribution_mechanism: DISTRIBUTION_MECHANISM.DELEGATES_LISTS;
    delegates_portions: DELEGATE_PORTIONS;
    delegate_single_portion?: number;
}

export interface DirectAidForm extends BaseAidForm {
    distribution_mechanism: DISTRIBUTION_MECHANISM.DISPLACED_FAMILIES;
}

export type AddAidFormValues = DelegateAidForm | DirectAidForm;

//////////////////////////////////////////////////////
// FINAL AID ENTITY
//////////////////////////////////////////////////////

export type Aid = AddAidFormValues & {
    id: number;
    apiId?: string;
    version?: number;
    /** Exact synchronized values retained for lifecycle editing. */
    apiType?: string;
    apiUnit?: string;
    apiDistributionDate?: string;
    distribution_count?: number;
    received_distribution_count?: number;
    selected_displaced_Ids: number[];
    selected_delegates_portions?: SelectedDelegatePortion[];
    received_displaceds: ReceivedDisplaceds[];
    security_men?: number[];
    is_completed: boolean;
    aid_status: TYPE_GROUP_AIDS;
};

//////////////////////////////////////////////////////
// HELPER TYPE FOR RECEIVED ITEMS
//////////////////////////////////////////////////////

export interface ReceivedDisplaceds {
    displaced_Id: number;
    received_time: Date;
}

//////////////////////////////////////////////////////
// API RESPONSE TYPES
//////////////////////////////////////////////////////

export interface AidResponse {
    status: number;
    message?: string;
    aid: Aid;
    error?: string;
}

export interface AidsResponse {
    status: number;
    message?: string;
    aids: Aid[];
    error?: string;
    pagination: {
        page: number;
        limit: number;
        total_items: number;
        total_pages: number;
    };
}
