import { Avatar, Box, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/utils/cn';
import useAuth from '@/hooks/useAuth';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';
import { Activity, Bell, ClipboardList, HandHeart, Home, LogOut, Megaphone, MessageSquareWarning, ShieldCheck, User, UserCog, Users } from 'lucide-react';
import { clearAuthRole, clearAuthToken, clearAuthUser } from '@/utils/auth/getSession';
import { USER_RANK_LABELS, UserRank } from '@/constants/userTypes';
import { NAZEH_LOGO } from '@/assets/common';

interface NavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface NavGroup {
  title: string;
  links: NavLink[];
}

export default function Actor_Navbar({ onNavigate }: { onNavigate?: () => void }) {
  const { isDelegate, isDisplaced, isSecurity, isSecurityOfficer, isManager, isAdmin, user } = useAuth();
  const [location] = useLocation();

  const navGroups = useMemo<NavGroup[]>(() => {
    if (isDisplaced) {
      return [{
        title: 'بوابة المستفيد',
        links: [{ label: 'ملف الأسرة وطلباتها', href: GENERAL_ACTOR_ROUTES.FAMILY, icon: Home }]
      }];
    }

    const groups: NavGroup[] = [];

    // الرئيسية
    groups.push({
      title: 'الرئيسية',
      links: [
        { label: 'لوحة العمليات', href: GENERAL_ACTOR_ROUTES.OPERATIONS, icon: Activity },
        { label: 'ملفي الشخصي', href: GENERAL_ACTOR_ROUTES.PROFILE, icon: User },
      ]
    });

    // الميدان
    const fieldLinks: NavLink[] = [];
    if (isManager || isDelegate) {
      fieldLinks.push({ label: 'إدارة الأسر', href: GENERAL_ACTOR_ROUTES.FAMILIES, icon: Users });
      fieldLinks.push({ label: 'الاحتياجات', href: GENERAL_ACTOR_ROUTES.NEEDS, icon: ClipboardList });
      fieldLinks.push({ label: 'المساعدات', href: GENERAL_ACTOR_ROUTES.AIDS, icon: HandHeart });
    } else if (isSecurityOfficer) {
      fieldLinks.push({ label: 'الاحتياجات', href: GENERAL_ACTOR_ROUTES.NEEDS, icon: ClipboardList });
    }
    
    if (isSecurity || isSecurityOfficer || isManager) {
      fieldLinks.push({ label: 'المهام الأمنية', href: GENERAL_ACTOR_ROUTES.TASKS, icon: ShieldCheck });
    }
    
    if (fieldLinks.length > 0) {
      groups.push({ title: 'العمليات الميدانية', links: fieldLinks });
    }

    // المتابعة
    groups.push({
      title: 'المتابعة والتقارير',
      links: [
        { label: 'الشكاوى', href: '/actor/complaints', icon: MessageSquareWarning },
        { label: 'التقارير', href: GENERAL_ACTOR_ROUTES.REPORTS, icon: Activity },
        { label: 'الإشعارات', href: '/actor/notifications', icon: Bell },
      ]
    });
    
    // الإدارة
    const adminLinks: NavLink[] = [];
    if (isManager || isAdmin || isDelegate) {
      adminLinks.push({ label: 'المحتوى', href: '/actor/content', icon: Megaphone });
    }
    if (isAdmin) {
      adminLinks.push({ label: 'الموظفين', href: GENERAL_ACTOR_ROUTES.STAFF, icon: UserCog });
    }
    if (adminLinks.length > 0) {
      groups.push({ title: 'الإدارة', links: adminLinks });
    }

    return groups;
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
    <Box className="flex h-full w-full flex-col text-sidebar-foreground">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-6 bg-sidebar">
        <img src={NAZEH_LOGO} alt="نازح" className="h-12 w-auto shrink-0" />
        <Text fz={10} c="dimmed" className="leading-tight">منصة إدارة المخيمات الإنسانية</Text>
      </div>

      {/* User Profile Summary */}
      <div className="shrink-0 p-5 pb-2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md">
          <Avatar
            src={user?.profile_image}
            color="teal"
            radius="md"
            size={42}
            className="ring-2 ring-background"
          >
            {user?.name?.charAt(0) || 'م'}
          </Avatar>
          <div className="min-w-0 flex-1">
            <Text size="sm" fw={700} className="truncate text-card-foreground leading-tight">{user?.name}</Text>
            <Text size="xs" c="dimmed" className="truncate leading-tight mt-1 font-medium">
              {USER_RANK_LABELS[user?.rank as UserRank] || 'فريق المخيم'}
            </Text>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <ScrollArea className="flex-1 custom-scrollbar" offsetScrollbars>
        <div className="p-4 flex flex-col gap-6">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx}>
              <Text fz={11} fw={800} className="mb-2 px-2 text-muted-foreground uppercase tracking-widest opacity-80">
                {group.title}
              </Text>
              <Stack gap={3}>
                {group.links.map((link, lIdx) => {
                  const isActive = isLinkActive(link.href);
                  return (
                    <Link key={lIdx} href={`~${link.href}`} onClick={onNavigate}>
                      <UnstyledButton
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-right transition-all duration-200 ease-in-out',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <link.icon size={18} className={cn(
                          "shrink-0 transition-transform duration-200",
                          isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        <Text fz={14} fw={isActive ? 700 : 500} className="flex-1 truncate">
                          {link.label}
                        </Text>
                        {isActive && (
                          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-in zoom-in" />
                        )}
                      </UnstyledButton>
                    </Link>
                  );
                })}
              </Stack>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer / Logout */}
      <div className="shrink-0 border-t border-sidebar-border p-4 bg-sidebar">
        <UnstyledButton
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-right text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive font-medium"
        >
          <LogOut size={18} />
          <Text size="sm" fw={600}>تسجيل الخروج</Text>
        </UnstyledButton>
      </div>
    </Box>
  );
}
