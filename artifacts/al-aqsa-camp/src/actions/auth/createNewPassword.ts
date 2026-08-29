import { commonActionResponse } from "@/@types/common/action/commonActionResponse.type";
import { completeCredential } from "@workspace/api-client-react";



export type createNewPasswordProps = {
    token: string
    password: string;
    confirm_password: string;
}

export const createNewPassword = async ({ token, password, confirm_password }: createNewPasswordProps): Promise<commonActionResponse> => {
    try {
        if (password !== confirm_password) throw new Error("كلمات المرور غير متطابقة");
        await completeCredential({ token, password });
        return { status: 200, message: "تم تحديث كلمة المرور بنجاح" };
    } catch (error: any) {
        return {
            status: error.status || 500,
            message: error.message || "فشل في تحديث كلمة المرور",
            error: error.message || "فشل في تحديث كلمة المرور"
        };
    }
}
