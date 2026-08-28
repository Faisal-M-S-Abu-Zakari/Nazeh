
import { commonActionResponse } from "@/@types/common/action/commonActionResponse.type";

export interface deleteAidProps {
    aid_Id: number;
    manager_Id: number;
}

export const deleteAid = async ({
    aid_Id,
    manager_Id
}: deleteAidProps): Promise<commonActionResponse> => {
    return {
        status: 501,
        message: 'حذف المساعدات غير مدعوم حالياً',
        error: 'حذف المساعدات ينتظر تنفيذ دورة الحياة في المهمة 9',
    };
};