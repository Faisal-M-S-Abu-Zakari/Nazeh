import { Role } from '@workspace/api-client-react';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';

export type StaffRouteRole = Role | 'displaced';

export type RouteAccessUser = {
  role: StaffRouteRole;
};

const managerRoles: StaffRouteRole[] = [Role.ADMIN, Role.MANAGER];
const allStaffRoles: StaffRouteRole[] = [
  Role.ADMIN,
  Role.MANAGER,
  Role.DELEGATE,
  Role.SECURITY_OFFICER,
  Role.SECURITY_MEMBER,
];

const hasRole = (role: StaffRouteRole, roles: StaffRouteRole[]) => roles.includes(role);

const legacyActorRedirects: Array<{ pattern: RegExp; target: string }> = [
  {
    pattern: /^\/actor\/delegates\/[^/]+\/aids-management$/,
    target: GENERAL_ACTOR_ROUTES.AIDS,
  },
  {
    pattern: /^\/actor\/delegates\/[^/]+\/profile$/,
    target: GENERAL_ACTOR_ROUTES.PROFILE,
  },
  {
    pattern: /^\/actor\/delegates\/[^/]+\/reports$/,
    target: GENERAL_ACTOR_ROUTES.REPORTS,
  },
  {
    pattern: /^\/actor\/manager\/[^/]+\/aids-management$/,
    target: GENERAL_ACTOR_ROUTES.AIDS,
  },
  {
    pattern: /^\/actor\/manager\/[^/]+\/profile$/,
    target: GENERAL_ACTOR_ROUTES.PROFILE,
  },
  {
    pattern: /^\/actor\/manager\/[^/]+\/reports$/,
    target: GENERAL_ACTOR_ROUTES.REPORTS,
  },
  {
    pattern: /^\/actor\/securities\/[^/]+\/profile$/,
    target: GENERAL_ACTOR_ROUTES.PROFILE,
  },
  {
    pattern: /^\/actor\/securities\/[^/]+\/tasks$/,
    target: GENERAL_ACTOR_ROUTES.TASKS,
  },
];

export function getLegacyActorRedirectTarget(pathname: string): string | null {
  const path = (pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/actor');
  return legacyActorRedirects.find(({ pattern }) => pattern.test(path))?.target ?? null;
}

export type ReplaceNavigation = (target: string, options: { replace: true }) => void;

export function navigateWithHistoryReplacement(target: string, navigate: ReplaceNavigation): void {
  navigate(target, { replace: true });
}

/**
 * The actor router is intentionally deny-by-default. A backend 403 is not a
 * substitute for hiding a screen: it still lets a user see its layout and
 * can trigger data requests before the server rejects them.
 */
export function canAccessActorPath(pathname: string, user: RouteAccessUser): boolean {
  const path = pathname.replace(/\/+$/, '') || '/actor';
  const role = user.role;

  if (path === '/actor/family' || path.startsWith('/actor/family/')) return role === 'displaced';
  if (path === '/actor' || path === '/actor/operations') return hasRole(role, allStaffRoles);
  if (path === '/actor/profile' || path === '/actor/reports' || path === '/actor/notifications') return hasRole(role, allStaffRoles);
  
  if (path === '/actor/families' || path.startsWith('/actor/families/')) {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE]);
  }
  if (path === '/actor/aids' || path.startsWith('/actor/aids/')) {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE]);
  }
  if (path === '/actor/needs' || path.startsWith('/actor/needs/')) {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE, Role.SECURITY_OFFICER]);
  }
  if (path === '/actor/tasks' || path.startsWith('/actor/tasks/')) {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.SECURITY_OFFICER, Role.SECURITY_MEMBER]);
  }
  if (path === '/actor/complaints' || path.startsWith('/actor/complaints/')) {
    return hasRole(role, allStaffRoles);
  }
  if (path === '/actor/content' || path.startsWith('/actor/content/')) {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE]);
  }
  
  if (path === '/actor/staff') return role === Role.ADMIN;

  if (
    /^\/actor\/delegates\/[^/]+\/(aids-management|profile|reports)$/.test(path) ||
    /^\/actor\/manager\/[^/]+\/(aids-management|profile|reports)$/.test(path) ||
    /^\/actor\/securities\/[^/]+\/(profile|tasks)$/.test(path)
  ) {
    return hasRole(role, allStaffRoles);
  }

  if (path === '/actor/ads' || path.startsWith('/actor/ads/')) {
    return hasRole(role, allStaffRoles);
  }
  if (path === '/actor/notifications') return hasRole(role, allStaffRoles);

  if (path === '/actor/delegates' || path === '/actor/delegates/add') {
    return hasRole(role, managerRoles);
  }
  if (path.startsWith('/actor/delegates/')) {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE]);
  }

  if (path === '/actor/displaceds') {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE]);
  }
  if (path === '/actor/displaceds/add') return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE]);
  if (path.startsWith('/actor/displaceds/')) {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE]);
  }

  if (path === '/actor/securities') return hasRole(role, [
    Role.ADMIN,
    Role.MANAGER,
    Role.SECURITY_OFFICER,
    Role.SECURITY_MEMBER,
  ]);
  if (path === '/actor/securities/add') return hasRole(role, managerRoles);
  if (path.startsWith('/actor/securities/')) {
    return hasRole(role, [
      Role.ADMIN,
      Role.MANAGER,
      Role.SECURITY_OFFICER,
      Role.SECURITY_MEMBER,
    ]);
  }

  if (path.startsWith('/actor/manager/')) {
    return hasRole(role, managerRoles);
  }

  return false;
}