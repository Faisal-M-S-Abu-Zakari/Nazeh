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
  const uiRole = role === Role.ADMIN ? USER_TYPE.ADMIN
    : role === Role.MANAGER ? USER_TYPE.MANAGER
      : role === Role.DELEGATE ? USER_TYPE.DELEGATE
        : role === Role.SECURITY_OFFICER ? USER_TYPE.SECURITY
          : USER_TYPE.SECURITY_MEMBER;
  const uiRank = role === Role.ADMIN ? USER_RANK.ADMIN
    : role === Role.MANAGER ? USER_RANK.MANAGER
      : role === Role.DELEGATE ? USER_RANK.DELEGATE
        : role === Role.SECURITY_OFFICER ? USER_RANK.SECURITY_OFFICER
          : USER_RANK.SECURITY_MEMBER;
  const user: User | null = me.data ? {
    id: canonicalIdToNumber(me.data.id),
    name: me.data.name,
    email: me.data.email,
    identity: me.data.id,
    phone_number: '',
    created_at: new Date(),
    profile_image: '',
    role: uiRole,
    rank: uiRank,
  } : null;

  return {
    isAuthenticated: Boolean(token && me.data),
    isLoading: Boolean(token) && (me.isLoading || me.isFetching),
    error: me.error,
    role,
    isManager: role === Role.MANAGER || role === Role.ADMIN,
    isAdmin: role === Role.ADMIN,
    isDelegate: role === Role.DELEGATE,
    isDisplaced: false,
    isSecurity: role === Role.SECURITY_OFFICER || role === Role.SECURITY_MEMBER,
    isSecurityOfficer: role === Role.SECURITY_OFFICER,
    user,
  };
}
