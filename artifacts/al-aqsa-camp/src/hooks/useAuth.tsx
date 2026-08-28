'use client';
import { getSession } from '../utils/auth/getSession';
import { useEffect, useState } from 'react';
import { User } from '@/@types/auth/loginResponse.type';
import { USER_RANK, USER_TYPE } from '@/constants/userTypes';

export default function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isDelegate, setIsDelegate] = useState(false);
  const [isDisplaced, setIsDisplaced] = useState(false);
  const [isSecurity, setIsSecurity] = useState(false);
  const [isSecurityOfficer, setIsSecurityOfficer] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setIsAuthenticated(true);
      setIsManager(session.user.role === USER_TYPE.MANAGER);
      setIsDelegate(session.user.role === USER_TYPE.DELEGATE);
      setIsDisplaced(session.user.role === USER_TYPE.DISPLACED);
      setIsSecurity(session.user.role === USER_TYPE.SECURITY);
      setIsSecurityOfficer(
        (session.user.role === USER_TYPE.SECURITY && session.user.rank) ===
          USER_RANK.SECURITY_OFFICER
      );
      setUser(session.user);
    }
  }, []);

  return {
    isAuthenticated,
    isManager,
    isDelegate,
    isDisplaced,
    isSecurity,
    isSecurityOfficer,
    user,
  };
}
