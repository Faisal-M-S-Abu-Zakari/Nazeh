import { z } from "zod";
import { isValidPhoneNumber } from 'react-phone-number-input';

export const contactUsSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, { message: 'الاسم يجب أن يكون حرفين على الأقل' })
        .max(200, { message: 'الاسم طويل جداً' }),

    email: z.string().trim().email({ message: 'البريد الإلكتروني غير صالح' }).max(254),

    phone_number: z
        .string({ required_error: 'رقم الجوال مطلوب' })
        .max(40, { message: 'رقم الجوال طويل جداً' })
        .refine(isValidPhoneNumber, { message: 'رقم الجوال غير صالح' }),


    message: z
        .string()
        .trim()
        .min(10, { message: 'الرسالة يجب أن تكون 10 أحرف على الأقل' })
        .max(10000, { message: 'الرسالة طويلة جداً' }),
});

export type contactUsType = z.infer<typeof contactUsSchema>;
