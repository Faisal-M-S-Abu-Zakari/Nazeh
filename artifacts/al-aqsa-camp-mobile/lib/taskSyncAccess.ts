const taskReaderRoles = new Set(['ADMIN', 'MANAGER', 'SECURITY_OFFICER', 'SECURITY_MEMBER']);

export function canReadTeamTasks(role: string | null | undefined): boolean {
  return !!role && taskReaderRoles.has(role);
}
