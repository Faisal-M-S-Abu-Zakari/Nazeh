import {
  Aid as ApiAid,
  createAid,
  createDelegate,
  createDisplacedPerson,
  Delegate,
  DisplacedPerson,
  listAids,
  listDelegates,
  listDisplacedPersons,
  login,
  logout as revokeSession,
  SessionResponse,
  setAuthTokenGetter,
  setBaseUrl,
} from '@workspace/api-client-react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Aid = { id: string; title: string; type: string; families: number; status: 'نشطة' | 'مكتملة'; date: string };
export type Person = { id: string; name: string; role: 'نازح' | 'مندوب' | 'حارس'; phone: string; location: string };

type SessionMetadata = Pick<SessionResponse, 'user' | 'expiresAt'>;
type AppValue = {
  signedIn: boolean;
  aids: Aid[];
  people: Person[];
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  addAid: (title: string, type: string) => Promise<void>;
  addPerson: (name: string, role: Person['role'], phone: string, email?: string) => Promise<void>;
};

const AppContext = createContext<AppValue | null>(null);
const domain = process.env.EXPO_PUBLIC_DOMAIN;
setBaseUrl(domain ? (domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`) : null);

let authToken: string | null = null;
setAuthTokenGetter(() => authToken);

function formatDate(value: string | null | undefined) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function mapAid(aid: ApiAid): Aid {
  return {
    id: String(aid.id),
    title: aid.title,
    type: aid.type,
    families: aid.recipientCount,
    status: aid.status === 'completed' || aid.status === 'cancelled' ? 'مكتملة' : 'نشطة',
    date: formatDate(aid.distributionDate ?? aid.createdAt),
  };
}

function mapDelegate(delegate: Delegate): Person {
  return { id: `delegate-${delegate.id}`, name: delegate.name, role: 'مندوب', phone: delegate.phone, location: delegate.area || 'غير محدد' };
}

function mapDisplacedPerson(person: DisplacedPerson): Person {
  return { id: `displaced-${person.id}`, name: person.name, role: 'نازح', phone: person.phone, location: person.location || 'غير محدد' };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionMetadata | null>(null);
  const [aids, setAids] = useState<Aid[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  const hydrateApiData = useCallback(async () => {
    const [aidPage, delegatePage, displacedPage] = await Promise.all([
      listAids(),
      listDelegates(),
      listDisplacedPersons(),
    ]);
    setAids(aidPage.items.map(mapAid));
    setPeople([...delegatePage.items.map(mapDelegate), ...displacedPage.items.map(mapDisplacedPerson)]);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await login({ email, password, role: 'manager' });
    authToken = nextSession.token;
    try {
      await hydrateApiData();
      setSession({ user: nextSession.user, expiresAt: nextSession.expiresAt });
    } catch (error) {
      authToken = null;
      throw error;
    }
  }, [hydrateApiData]);

  const signOut = useCallback(async () => {
    try {
      await revokeSession();
    } finally {
      authToken = null;
      setSession(null);
      setAids([]);
      setPeople([]);
    }
  }, []);

  const addAid = useCallback(async (title: string, type: string) => {
    const aid = await createAid({ title, type, quantity: 0 });
    setAids((current) => [mapAid(aid), ...current]);
  }, []);

  const addPerson = useCallback(async (name: string, role: Person['role'], phone: string, email?: string) => {
    if (role === 'حارس') {
      throw new Error('لا يمكن إضافة حارس حالياً لأن واجهة النظام لا توفر نقطة إنشاء لأفراد الأمن.');
    }
    if (role === 'مندوب') {
      if (!email?.trim()) throw new Error('البريد الإلكتروني مطلوب لإضافة المندوب.');
      const delegate = await createDelegate({ name, phone, email: email.trim() });
      setPeople((current) => [mapDelegate(delegate), ...current]);
      return;
    }
    const displacedPerson = await createDisplacedPerson({ name, phone, familySize: 1 });
    setPeople((current) => [mapDisplacedPerson(displacedPerson), ...current]);
  }, []);

  const value = useMemo<AppValue>(() => ({
    signedIn: session !== null,
    aids,
    people,
    signIn,
    signOut,
    addAid,
    addPerson,
  }), [addAid, addPerson, aids, people, session, signIn, signOut]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}