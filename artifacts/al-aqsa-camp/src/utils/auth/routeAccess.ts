import { Role } from '@workspace/api-client-react';
import { canonicalIdToNumber } from './canonicalId';

export type StaffRouteRole = Role;

export type RouteAccessUser = {
  id: string;
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

const ownsRouteRecord = (pathname: string, segment: string, user: RouteAccessUser) => {
  const match = pathname.match(new RegExp(`/${segment}/([^/]+)`));
  if (!match) return false;
  return canonicalIdToNumber(user.id) === Number(match[1]);
};

/**
 * The actor router is intentionally deny-by-default. A backend 403 is not a
 * substitute for hiding a screen: it still lets a user see its layout and
 * can trigger data requests before the server rejects them.
 */
export function canAccessActorPath(pathname: string, user: RouteAccessUser): boolean {
  const path = pathname.replace(/\/+$/, '') || '/actor';
  const role = user.role;

  if (path === '/actor' || path === '/actor/operations') return hasRole(role, allStaffRoles);
  if (path === '/actor/staff') return role === Role.ADMIN;

  if (path === '/actor/ads' || path.startsWith('/actor/ads/')) {
    return hasRole(role, allStaffRoles);
  }
  if (path === '/actor/notifications') return hasRole(role, allStaffRoles);

  if (path === '/actor/delegates' || path === '/actor/delegates/add') {
    return hasRole(role, managerRoles);
  }
  if (path.startsWith('/actor/delegates/')) {
    return role === Role.ADMIN ||
      role === Role.MANAGER ||
      (role === Role.DELEGATE && ownsRouteRecord(path, 'delegates', user));
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
    return role === Role.ADMIN ||
      role === Role.MANAGER ||
      ((role === Role.SECURITY_OFFICER || role === Role.SECURITY_MEMBER) &&
        ownsRouteRecord(path, 'securities', user));
  }

  if (path.startsWith('/actor/manager/')) {
    return hasRole(role, managerRoles) && ownsRouteRecord(path, 'manager', user);
  }

  return false;
}