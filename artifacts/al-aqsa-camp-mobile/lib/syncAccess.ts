export type StaffSyncResource = 'aids' | 'people' | 'complaints' | 'tasks';

const staffSyncRoles: Record<StaffSyncResource, ReadonlySet<string>> = {
  aids: new Set(['ADMIN', 'MANAGER', 'DELEGATE', 'SECURITY_OFFICER']),
  people: new Set(['ADMIN', 'MANAGER', 'DELEGATE']),
  complaints: new Set(['ADMIN', 'MANAGER', 'DELEGATE', 'SECURITY_OFFICER', 'SECURITY_MEMBER']),
  tasks: new Set(['ADMIN', 'MANAGER', 'SECURITY_OFFICER', 'SECURITY_MEMBER']),
};

export function isDisplacedAccount(role: string | null | undefined): boolean {
  return role?.toUpperCase() === 'DISPLACED';
}

export function canSyncStaffResource(role: string | null | undefined, resource: StaffSyncResource): boolean {
  return !!role && staffSyncRoles[resource].has(role.toUpperCase());
}
