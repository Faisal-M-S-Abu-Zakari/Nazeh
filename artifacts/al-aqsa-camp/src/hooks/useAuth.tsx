'use client';
import { getAuthRole, getAuthToken, getAuthUser, clearAuthRole, clearAuthToken, clearAuthUser } from '../utils/auth/getSession';
import { User } from '@/@types/auth/loginResponse.type';
import { USER_RANK, USER_TYPE } from '@/constants/userTypes';
import { getGetCurrentUserQueryKey, getGetFamilyMeQueryKey, Role, useGetCurrentUser, useGetFamilyMe } from '@workspace/api-client-react';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AUTH_ROUTES } from '@/constants/routes';
import { canonicalIdToNumber } from '@/utils/auth/canonicalId';
import { createAuthLifecycle } from '@/utils/auth/authLifecycle';

export default function useAuth() {
  const token = getAuthToken();
  const storedRole = getAuthRole();
  const queryClient = useQueryClient();
  const me = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      enabled: Boolean(token && storedRole !== 'displaced'),
      retry: (count, error) => !('status' in error && error.status === 401) && count < 2,
    },
  });
  const family = useGetFamilyMe({
    query: { queryKey: getGetFamilyMeQueryKey(), enabled: Boolean(token && storedRole === 'displaced'), retry: false },
    request: { headers: { Authorization: token ? `Bearer ${token}` : '' } },
  });
  useEffect(() => {
    const staffUnauthorized = me.error && 'status' in me.error && me.error.status === 401;
    const familyUnauthorized = family.error && 'status' in family.error && family.error.status === 401;
    if ((staffUnauthorized && storedRole !== 'displaced') || familyUnauthorized) {
      createAuthLifecycle({
        getToken: getAuthToken,
        setToken: () => undefined,
        clearToken: () => { clearAuthToken(); clearAuthRole(); clearAuthUser(); },
        clearQueries: () => queryClient.clear(),
        navigate: (path) => { window.location.href = path; },
      }).unauthorized(window.location.pathname, AUTH_ROUTES.LOGIN);
    }
  }, [family.error, me.error, queryClient, storedRole]);

  const role = me.data?.role;
  const legacyUser = family.data?.headUser;
  const storedFamilyUser = storedRole === 'displaced' ? getAuthUser() : null;
  const isDisplaced = storedRole === 'displaced' && Boolean(family.data || legacyUser || storedFamilyUser);
  const uiRole = isDisplaced ? USER_TYPE.DISPLACED
    : (role === Role.SECURITY_OFFICER || role === Role.SECURITY_MEMBER) ? USER_TYPE.SECURITY
    : role === Role.DELEGATE ? USER_TYPE.DELEGATE
    : USER_TYPE.MANAGER;
  const user: User | null = me.data || legacyUser || storedFamilyUser ? {
    id: canonicalIdToNumber(String(legacyUser?.id ?? me.data?.id ?? storedFamilyUser?.id)),
    name: legacyUser?.name ?? me.data?.name ?? storedFamilyUser?.name ?? '',
    email: legacyUser?.email ?? me.data?.email ?? storedFamilyUser?.email ?? '',
    identity: '',
    phone_number: legacyUser?.phone ?? storedFamilyUser?.phone ?? '',
    created_at: new Date(),
    profile_image: '',
    role: uiRole,
     rank: isDisplaced ? USER_RANK.DISPLACED : (role === Role.SECURITY_OFFICER || role === Role.SECURITY_MEMBER) ? USER_RANK.SECURITY_OFFICER : uiRole,
  } : null;

  return {
    isAuthenticated: Boolean(token && (me.data || isDisplaced)),
    isLoading: me.isLoading,
    error: me.error,
    role: isDisplaced ? 'displaced' as const : role,
    isManager: role === Role.MANAGER || role === Role.ADMIN,
    isAdmin: role === Role.ADMIN,
    isDelegate: role === Role.DELEGATE,
    isDisplaced,
    isSecurity: role === Role.SECURITY_OFFICER || role === Role.SECURITY_MEMBER,
    isSecurityOfficer: role === Role.SECURITY_OFFICER,
    user,
  };
}
