import { GENERAL_ACTOR_ROUTES, SECURITY_ROUTES_fUNC } from "@/constants/routes";
import { ListTodo, User, ShieldUser, BellRing, Newspaper, MessageCircleWarning } from "lucide-react";

//what appear to security 
export const security_NavLinks = (security_Id: number) => {

    const securityRoutes = SECURITY_ROUTES_fUNC({ security_Id });

    return [
        { label: 'الملف الشخصي', href: securityRoutes.PROFILE, icon: User },
        { label: 'الإشعارات', href: GENERAL_ACTOR_ROUTES.NOTIFICATIONS, icon: BellRing },
        {
            label: 'بيانات الأمن',
            href: GENERAL_ACTOR_ROUTES.SECURITIES,
            icon: ShieldUser,
        },
        { label: 'المهام', href: securityRoutes.TASKS, icon: ListTodo },
        { label: 'الشكاوي', href: securityRoutes.COMPLAINTS, icon: MessageCircleWarning },
        { label: 'الإعلانات', href: GENERAL_ACTOR_ROUTES.ADS, icon: Newspaper },
    ] as const;
};

//what appear when manger or security officer open security page
export const manager_OR_Security_Guest_Security_NavLinks = (security_Id: number) => {
    const securityRoutes = SECURITY_ROUTES_fUNC({ security_Id });

    return [
        { label: 'الملف الشخصي', href: securityRoutes.PROFILE, icon: User },
        { label: 'المهام', href: securityRoutes.TASKS, icon: ListTodo },
    ] as const;
};

//what appear when anu user open security page
export const guest_Security_NavLinks = (security_Id: number) => {
    const securityRoutes = SECURITY_ROUTES_fUNC({ security_Id });

    return [
        { label: 'الملف الشخصي', href: securityRoutes.PROFILE, icon: User },
    ] as const;
};

