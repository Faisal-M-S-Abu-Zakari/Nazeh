import { Avatar, Box, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/utils/cn';
import useAuth from '@/hooks/useAuth';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';
import { BarChart3, Bell, ChevronLeft, ClipboardList, HandHeart, Home, LogOut, Megaphone, MessageSquareWarning, ShieldCheck, User, UserCog, Users } from 'lucide-react';
import { clearAuthRole, clearAuthToken, clearAuthUser } from '@/utils/auth/getSession';
import { USER_RANK_LABELS, UserRank } from '@/constants/userTypes';

interface NavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function Actor_Navbar({ onNavigate }: { onNavigate?: () => void }) {
  const { isDelegate, isDisplaced, isSecurity, isSecurityOfficer, isManager, isAdmin, user } = useAuth();
  const [location, setLocation] = useLocation();

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
    
    links.push({ label: 'الشكاوى', href: '/actor/complaints', icon: MessageSquareWarning });
    links.push({ label: 'التقارير', href: GENERAL_ACTOR_ROUTES.REPORTS, icon: BarChart3 });
    links.push({ label: 'الإشعارات', href: '/actor/notifications', icon: Bell });
    
    if (isManager || isAdmin || isDelegate) {
      links.push({ label: 'إدارة المحتوى', href: '/actor/content', icon: Megaphone });
    }
    if (isAdmin) {
      links.push({ label: 'إدارة الموظفين', href: GENERAL_ACTOR_ROUTES.STAFF, icon: UserCog });
    }
    return links;
  }, [isAdmin, isDelegate, isDisplaced, isManager, isSecurity, isSecurityOfficer]);

  const fullLocation = location.startsWith('/actor')
    ? location
    : `/actor${location === '/' ? '' : location}`;

  const isLinkActive = (href: string) =>
    fullLocation === href || fullLocation.startsWith(`${href}/`);

  const handleLogout = () => {
    clearAuthToken();
    clearAuthRole();
    clearAuthUser();
    window.location.href = '/auth/login';
  };

  return (
    <Box className="flex h-full w-full flex-col bg-[#f5f7f5] p-4 text-slate-800">
      <div className="mb-4 rounded-[20px] border border-slate-100 bg-white px-4 pb-5 pt-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
            أقصى
          </div>
          <div>
            <Text fw={800} fz={17} className="font-display text-slate-900">مخيم الأقصى</Text>
            <Text fz={11} c="dimmed">منصة إدارة شؤون المخيم</Text>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Avatar
            src={user?.profile_image}
            color="teal"
            radius="xl"
            size={54}
            className="border-2 border-emerald-100"
          >
            {user?.name?.charAt(0) || 'م'}
          </Avatar>
          <div className="min-w-0 flex-1">
            <Text size="sm" fw={700} className="truncate text-slate-900">{user?.name}</Text>
            <Text size="xs" c="dimmed" className="truncate">
              {USER_RANK_LABELS[user?.rank as UserRank] || 'فريق المخيم'}
            </Text>
          </div>
        </div>
      </div>

      <div className="mb-2 px-2">
        <Text fz={11} fw={700} className="text-slate-400">القائمة الرئيسية</Text>
      </div>

      <ScrollArea className="min-h-0 flex-1" type="auto" offsetScrollbars>
        <Stack gap={3} className="rounded-[20px] border border-slate-100 bg-white p-2 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          {navLinks.map((link, index) => {
            const isActive = isLinkActive(link.href);
            return (
              <Link key={index} href={`~${link.href}`} className="no-underline" onClick={onNavigate}>
                <UnstyledButton
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-right transition-colors',
                    isActive
                      ? 'bg-primary text-white shadow-[0_6px_16px_rgba(26,124,83,0.2)]'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-primary'
                  )}
                >
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                    isActive ? 'bg-white/15 text-white' : 'bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-primary'
                  )}>
                    <link.icon size={18} />
                  </span>
                  <Text fz={14} fw={isActive ? 700 : 500} className="flex-1 truncate">
                    {link.label}
                  </Text>
                  <ChevronLeft size={15} className={isActive ? 'text-white/80' : 'text-slate-300'} />
                </UnstyledButton>
              </Link>
            );
          })}
        </Stack>
      </ScrollArea>

      <div className="pt-3">
        <UnstyledButton
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-white py-2.5 text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut size={16} />
          <Text size="sm" fw={600}>تسجيل الخروج</Text>
        </UnstyledButton>
      </div>
    </Box>
  );
}
