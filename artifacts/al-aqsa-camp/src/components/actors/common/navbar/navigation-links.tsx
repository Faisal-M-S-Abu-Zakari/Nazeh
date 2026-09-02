'use client';

import { Box, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { Link as Link } from '@/lib/nextjs-mocks';
import { usePathname  } from '@/lib/nextjs-mocks';
import { cn } from '@/utils/cn';
import useAuth from '@/hooks/useAuth';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';
import { BarChart3, ClipboardList, HandHeart, Home, ShieldCheck, User, Users, UserCog } from 'lucide-react';

interface NavLink {
  label: string;
  href: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export default function Navigation_Links() {
  const { isDelegate, isDisplaced, isSecurity, isSecurityOfficer, isManager, isAdmin } = useAuth();
  const pathname = usePathname();

  const navLinks = useMemo<NavLink[]>(() => {
    if (isDisplaced) {
      return [{ label: 'ملف الأسرة وطلباتها', href: GENERAL_ACTOR_ROUTES.FAMILY, icon: Home }];
    }
    const links: NavLink[] = [
      { label: 'لوحة العمليات', href: GENERAL_ACTOR_ROUTES.OPERATIONS, icon: Home },
      { label: 'ملفي الشخصي', href: GENERAL_ACTOR_ROUTES.PROFILE, icon: User },
    ];
    if (isManager || isDelegate) {
      links.push(
        { label: 'الأسر والإيواء', href: GENERAL_ACTOR_ROUTES.FAMILIES, icon: Users },
        { label: 'الاحتياجات والطلبات', href: GENERAL_ACTOR_ROUTES.NEEDS, icon: ClipboardList },
        { label: 'المساعدات والتسليم', href: GENERAL_ACTOR_ROUTES.AIDS, icon: HandHeart },
      );
    } else if (isSecurityOfficer) {
      links.push({ label: 'الاحتياجات العاجلة', href: GENERAL_ACTOR_ROUTES.NEEDS, icon: ClipboardList });
    }
    if (isSecurity || isSecurityOfficer || isManager) {
      links.push({ label: 'المهام الأمنية', href: GENERAL_ACTOR_ROUTES.TASKS, icon: ShieldCheck });
    }
    links.push({ label: 'التقارير', href: GENERAL_ACTOR_ROUTES.REPORTS, icon: BarChart3 });
    if (isAdmin) links.push({ label: 'إدارة الموظفين', href: GENERAL_ACTOR_ROUTES.STAFF, icon: UserCog });
    return links;
  }, [isAdmin, isDelegate, isDisplaced, isManager, isSecurity, isSecurityOfficer]);

  const isLinkActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <Box w='100%' className='bg-white shadow-lg border border-gray-200 rounded-2xl overflow-hidden'>
      <Stack gap={0}>
        {navLinks.map((link, index) => {
          const isActive = isLinkActive(link.href);

          return (
            <Link
              key={index}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-5 py-4 transition-colors duration-200',
                'border-b border-gray-100 last:border-b-0',
                isActive
                  ? 'bg-primary text-white font-semibold'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-dark'
              )}
            >
              {link.icon && (
                <link.icon
                  size={20}
                  className={cn(
                    'transition-colors duration-200',
                    isActive ? 'text-white' : 'text-gray-500'
                  )}
                />
              )}

              <Text fz={15} fw={isActive ? 600 : 400} className='truncate'>
                {link.label}
              </Text>
            </Link>
          );
        })}
      </Stack>
    </Box>
  );
}
