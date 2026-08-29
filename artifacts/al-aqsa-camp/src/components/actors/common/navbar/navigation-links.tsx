'use client';

import { Box, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { Link as Link } from '@/lib/nextjs-mocks';
import { usePathname  } from '@/lib/nextjs-mocks';
import { cn } from '@/utils/cn';
import useAuth from '@/hooks/useAuth';
import { managerNavLinks, guestManagerNavLinks } from '@/content/actor/manager/navLinks';
import {
  delegate_NavLinks,
  guest_Delegate_NavLinks,
  displaced_As_Guest_Delegate_NavLinks,
  security_OR_delegate_As_Guest_Delegate_NavLinks,
} from '@/content/actor/delegate/navLinks';
import {
  security_NavLinks,
  guest_Security_NavLinks,
  manager_OR_Security_Guest_Security_NavLinks,
} from '@/content/actor/security/navLinks';
import { displaced_NavLinks, guest_Displaced_NavLinks } from '@/content/actor/displaced/navLinks';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';

interface NavLink {
  label: string;
  href: string;
  icon?: React.ComponentType<{ size?: number }>;
}

export default function Navigation_Links() {
  const { user, isDelegate, isDisplaced, isSecurity, isSecurityOfficer, isManager, isAdmin } = useAuth();
  const userId = Number(user?.id) || 0;
  const pathname = usePathname();

  const extractId = (key: string) => {
    const parts = pathname.split('/');
    const idx = parts.indexOf(key) + 1;
    return idx > 0 && idx < parts.length ? Number(parts[idx]) || 0 : 0;
  };

  const navLinks = useMemo(() => {
    if (pathname.includes('/displaceds/')) {
      if (pathname.includes('/displaceds/add') && isManager) {
        return managerNavLinks(userId, isAdmin);
      } else if (pathname.includes('/displaceds/add') && isDelegate) {
        return delegate_NavLinks(userId);
      } else {
        const id = extractId('displaceds');
        if (isDisplaced && userId === id) return displaced_NavLinks(userId);
        return guest_Displaced_NavLinks(id);
      }
    }

    if (pathname.includes('/delegates/')) {
      if (pathname.includes('/delegates/add') && isManager) {
        return managerNavLinks(userId, isAdmin);
      } else {
        const id = extractId('delegates');
        if (isDelegate && userId === id) return delegate_NavLinks(userId);
        if (isDisplaced) return displaced_As_Guest_Delegate_NavLinks(id);
        if (isDelegate || isSecurity) return security_OR_delegate_As_Guest_Delegate_NavLinks(id);
        return guest_Delegate_NavLinks(id);
      }
    }

    if (pathname.includes('/securities/')) {
      if (pathname.includes('/securities/add') && isManager) {
        return managerNavLinks(userId, isAdmin);
      } else if (pathname.includes('/securities/add') && isSecurityOfficer) {
        return security_NavLinks(userId);
      } else {
        const id = extractId('securities');
        if ((isSecurity || isSecurityOfficer) && userId === id) return security_NavLinks(userId);
        return manager_OR_Security_Guest_Security_NavLinks(id);
      }
    }

    if (pathname.includes('/manager/')) {
      const id = extractId('manager');
      if (isManager && userId === id) return managerNavLinks(userId, isAdmin);
      return guestManagerNavLinks(id);
    }

    if (isDisplaced) return displaced_NavLinks(userId);
    if (isDelegate) return delegate_NavLinks(userId);
    if (isSecurity || isSecurityOfficer) return security_NavLinks(userId);
    if (isManager) return managerNavLinks(userId, isAdmin);

    return [];
  }, [pathname, userId, isDisplaced, isDelegate, isSecurity, isSecurityOfficer, isManager, isAdmin]);

  const isLinkActive = (href: string) => {
    return href === GENERAL_ACTOR_ROUTES.SECURITIES
      ? pathname === GENERAL_ACTOR_ROUTES.SECURITIES
      : pathname.includes(href);
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
