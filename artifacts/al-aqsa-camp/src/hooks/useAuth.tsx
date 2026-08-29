'use client';
import { getAuthToken, clearAuthToken } from '../utils/auth/getSession';
import { User } from '@/@types/auth/loginResponse.type';
import { USER_RANK, USER_TYPE } from '@/constants/userTypes';
import { getGetCurrentUserQueryKey, Role, useGetCurrentUser } from '@workspace/api-client-react';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AUTH_ROUTES } from '@/constants/routes';
import { canonicalIdToNumber } from '@/utils/auth/canonicalId';
import { createAuthLifecycle } from '@/utils/auth/authLifecycle';

export default function useAuth() {
  const token = getAuthToken();
  const queryClient = useQueryClient();
  const me = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      enabled: Boolean(token),
      retry: (count, error) => !('status' in error && error.status === 401) && count < 2,
    },
  });
  useEffect(() => {
    if (me.error && 'status' in me.error && me.error.status === 401) {
      createAuthLifecycle({
        getToken: getAuthToken,
        setToken: () => undefined,
        clearToken: clearAuthToken,
        clearQueries: () => queryClient.clear(),
        navigate: (path) => { window.location.href = path; },
      }).unauthorized(window.location.pathname, AUTH_ROUTES.LOGIN);
    }
  }, [me.error, queryClient]);

  const role = me.data?.role;
  const uiRole = role === Role.SECURITY_OFFICER ? USER_TYPE.SECURITY
    : role === Role.DELEGATE ? USER_TYPE.DELEGATE
    : USER_TYPE.MANAGER;
  const user: User | null = me.data ? {
    id: canonicalIdToNumber(me.data.id),
    name: me.data.name,
    email: me.data.email,
    identity: '',
    phone_number: '',
    created_at: new Date(),
    profile_image: '',
    role: uiRole,
    rank: role === Role.SECURITY_OFFICER ? USER_RANK.SECURITY_OFFICER : uiRole,
  } : null;

  return {
    isAuthenticated: Boolean(token && me.data),
    isLoading: me.isLoading,
    error: me.error,
    isManager: role === Role.MANAGER || role === Role.ADMIN,
    isAdmin: role === Role.ADMIN,
    isDelegate: role === Role.DELEGATE,
    isDisplaced: false,
    isSecurity: role === Role.SECURITY_OFFICER,
    isSecurityOfficer: role === Role.SECURITY_OFFICER,
    user,
  };
}
