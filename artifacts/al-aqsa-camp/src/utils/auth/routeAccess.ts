import { Role } from '@workspace/api-client-react';

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

/**
 * The actor router is intentionally deny-by-default. A backend 403 is not a
 * substitute for hiding a screen: it still lets a user see its layout and
 * can trigger data requests before the server rejects them.
 */
export function canAccessActorPath(pathname: string, user: RouteAccessUser): boolean {
  const path = pathname.replace(/\/+$/, '') || '/actor';
  const role = user.role;

  if (path === '/actor/family') return role === 'displaced';
  if (path === '/actor' || path === '/actor/operations') return hasRole(role, allStaffRoles);
  if (path === '/actor/profile' || path === '/actor/reports') return hasRole(role, allStaffRoles);
  if (path === '/actor/families' || path === '/actor/aids') {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE]);
  }
  if (path === '/actor/needs') return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.DELEGATE, Role.SECURITY_OFFICER]);
  if (path === '/actor/tasks') {
    return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.SECURITY_OFFICER, Role.SECURITY_MEMBER]);
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