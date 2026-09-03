import { Box, Stack, Text, UnstyledButton, ScrollArea, Avatar, Divider } from '@mantine/core';
import { useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/utils/cn';
import useAuth from '@/hooks/useAuth';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';
import { BarChart3, ClipboardList, HandHeart, Home, ShieldCheck, User, Users, UserCog, Megaphone, Bell, MessageSquareWarning, LogOut } from 'lucide-react';
import { clearAuthRole, clearAuthToken, clearAuthUser } from '@/utils/auth/getSession';

interface NavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function Actor_Navbar() {
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

  const isLinkActive = (href: string) => {
    return location === href || location.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    clearAuthToken();
    clearAuthRole();
    clearAuthUser();
    window.location.href = '/auth/login';
  };

  return (
    <Box className="flex flex-col h-full bg-sidebar border-l border-sidebar-border shadow-xl w-64 text-sidebar-foreground">
      <div className="p-6 flex items-center justify-center border-b border-sidebar-border/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shadow-inner">
            <span className="text-secondary-foreground font-display font-bold text-xl">أقصى</span>
          </div>
          <Text className="font-display font-bold text-lg tracking-wide text-white">مخيم الأقصى</Text>
        </div>
      </div>

      <ScrollArea className="flex-1" type="auto" offsetScrollbars>
        <Stack gap={4} className="p-3">
          {navLinks.map((link, index) => {
            const isActive = isLinkActive(link.href);
            return (
              <Link key={index} href={link.href} className="no-underline">
                <UnstyledButton
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                    isActive 
                      ? 'bg-primary/40 text-white font-medium border border-primary/50 shadow-sm' 
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-border hover:text-white'
                  )}
                >
                  <link.icon
                    size={20}
                    className={cn(
                      'transition-colors duration-200',
                      isActive ? 'text-secondary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/90'
                    )}
                  />
                  <Text fz={15} fw={isActive ? 600 : 500} className="truncate">
                    {link.label}
                  </Text>
                </UnstyledButton>
              </Link>
            );
          })}
        </Stack>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border/50 bg-sidebar-border/20 mt-auto">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar color="teal" radius="xl" size="md">{user?.name?.charAt(0) || 'م'}</Avatar>
          <div className="overflow-hidden">
            <Text size="sm" fw={600} className="text-white truncate">{user?.name}</Text>
            <Text size="xs" className="text-sidebar-foreground/60 truncate">{user?.email}</Text>
          </div>
        </div>
        <UnstyledButton 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <LogOut size={16} />
          <Text size="sm" fw={500}>تسجيل الخروج</Text>
        </UnstyledButton>
      </div>
    </Box>
  );
}
