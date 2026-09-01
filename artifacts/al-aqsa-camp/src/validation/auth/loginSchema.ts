import { z } from "zod";

export const loginSchema = z.object({
    email: z
        .string({ required_error: "حقل البريد الإلكتروني مطلوب" })
        .email("صيغة البريد الإلكتروني غير صحيحة"),
    password: z
        .string({ required_error: "حقل كلمة المرور مطلوب" })
        .min(8, "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل")
        .max(128, "يجب ألا تتجاوز كلمة المرور 128 حرفًا"),
});

export type loginType = z.infer<typeof loginSchema>;
