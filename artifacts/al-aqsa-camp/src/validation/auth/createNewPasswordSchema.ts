import { z } from "zod";

export const createNewPasswordSchema = z
    .object({
        password: z
            .string({ required_error: 'الحقل مطلوب' })
            .min(12, 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل')
            .regex(/[a-z]/, 'يجب أن تحتوي كلمة المرور على حرف إنجليزي صغير')
            .regex(/[A-Z]/, 'يجب أن تحتوي كلمة المرور على حرف إنجليزي كبير')
            .regex(/[0-9]/, 'يجب أن تحتوي كلمة المرور على رقم')
            .regex(/[^A-Za-z0-9]/, 'يجب أن تحتوي كلمة المرور على رمز'),
        confirm_password: z.string(),
    })
    .refine((data) => data.password === data.confirm_password, {
        message: 'كلمات المرور غير متطابقة',
        path: ['confirm_password'],
    });

export type createNewPasswordType = z.infer<typeof createNewPasswordSchema>;
