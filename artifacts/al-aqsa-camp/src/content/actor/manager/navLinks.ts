import { GENERAL_ACTOR_ROUTES, MANAGER_ROUTES_fUNC } from '@/constants/routes';
import { ShieldUser, Database, Newspaper, Handshake, User, Users, FileChartLine, MessageCircleWarning, UserCog } from 'lucide-react';



//what appear to manager 
export const managerNavLinks = (manager_Id: number, isAdmin = false) => {

    const managerRoutes = MANAGER_ROUTES_fUNC({ manager_Id });

    return [
        { label: 'الملف الشخصي', href: managerRoutes.PROFILE, icon: User },
        // Navigation_Links renders inside the nested /actor router, so this
        // must be actor-relative rather than repeating the /actor prefix.
        ...(isAdmin ? [{ label: 'إدارة الموظفين', href: 'staff', icon: UserCog }] : []),
        { label: 'بيانات النازحين', href: GENERAL_ACTOR_ROUTES.DISPLACEDS, icon: Database },
        {
            label: 'بيانات المناديب',
            href: GENERAL_ACTOR_ROUTES.DELEGATES,
            icon: Users,
        },
        {
            label: 'بيانات الأمن',
            href: GENERAL_ACTOR_ROUTES.SECURITIES,
            icon: ShieldUser,
        },
        {
            label: 'إدارة المساعدات',
            href: managerRoutes.AIDS_MANAGEMENT,
            icon: Handshake,
        },
        { label: 'الشكاوي', href: managerRoutes.COMPLAINTS, icon: MessageCircleWarning },
        { label: 'التقارير', href: managerRoutes.REPORTS, icon: FileChartLine },
        { label: 'الإعلانات و المدونات', href: managerRoutes.ADS_BLOGS_STORIES, icon: Newspaper },
    ] as const;
};


//what appear when any user open manager pages
export const guestManagerNavLinks = (manager_Id: number) => {
    const managerRoutes = MANAGER_ROUTES_fUNC({ manager_Id });

    return [
        { label: 'الملف الشخصي', href: managerRoutes.PROFILE, icon: User },
        { label: 'الشكاوي', href: managerRoutes.COMPLAINTS, icon: MessageCircleWarning },
    ] as const;
};
