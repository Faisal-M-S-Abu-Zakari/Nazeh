import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  type Aid as ApiAid,
  type AidType,
  type Complaint,
  type ComplaintStatus,
  type CreateAidRequest,
  type CreatePersonRequest,
  type StaffUser,
  type Task,
  type TaskStatus,
  createAid,
  createPerson,
  getListAidsQueryKey,
  getListComplaintsQueryKey,
  getListPeopleQueryKey,
  getListTasksQueryKey,
  getGetCurrentUserQueryKey,
  setAuthTokenGetter,
  setBaseUrl,
  updateComplaintStatus,
  updateTaskStatus,
  useGetCurrentUser,
  useListAids,
  useListComplaints,
  useListPeople,
  useListTasks,
  useLogin,
  useLogout,
  type Person as ApiPerson,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { cacheStorageKey, createMobileAuthLifecycle, loadOwnerStorage, queueStorageKey, replayOwnerQueue } from './offlineSync';

export type Aid = { id: string; title: string; type: string; families: number; status: 'نشطة' | 'مكتملة'; date: string };
export type Person = { id: string; name: string; role: 'نازح'; phone: string; location: string };
export type SyncState = 'syncing' | 'synced' | 'offline' | 'error';

type Cache = { aids: ApiAid[]; people: ApiPerson[]; complaints: Complaint[]; tasks: Task[] };
type QueuedWrite =
  | { id: string; ownerUserId: string; kind: 'aid'; data: CreateAidRequest }
  | { id: string; ownerUserId: string; kind: 'person'; data: CreatePersonRequest }
  | { id: string; ownerUserId: string; kind: 'complaint'; targetId: string; status: ComplaintStatus; expectedVersion: number }
  | { id: string; ownerUserId: string; kind: 'task'; targetId: string; status: TaskStatus; expectedVersion: number };

type MutationResult = { queued: boolean };
type AppValue = {
  signedIn: boolean;
  authLoading: boolean;
  user: StaffUser | null;
  aids: Aid[];
  people: Person[];
  complaints: Complaint[];
  tasks: Task[];
  syncState: SyncState;
  syncMessage: string;
  queuedCount: number;
  pendingWrites: QueuedWrite[];
  canManageAids: boolean;
  canManagePeople: boolean;
  canManageComplaints: boolean;
  canManageTasks: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  addAid: (data: CreateAidRequest) => Promise<MutationResult>;
  addPerson: (data: CreatePersonRequest) => Promise<MutationResult>;
  setComplaintStatus: (id: string, status: ComplaintStatus, expectedVersion: number) => Promise<MutationResult>;
  setTaskStatus: (id: string, status: TaskStatus, expectedVersion: number) => Promise<MutationResult>;
  retrySync: () => Promise<void>;
  discardQueuedWrite: (id: string) => Promise<void>;
};

const AppContext = createContext<AppValue | null>(null);
const TOKEN_KEY = 'al-aqsa-auth-token';
const emptyCache: Cache = { aids: [], people: [], complaints: [], tasks: [] };

/**
 * Expo development receives the Metro host (foo.expo.bar.replit.dev), while
 * the API proxy is its sibling (foo.bar.replit.dev). This deliberately only
 * rewrites that Replit development hostname shape; all custom/published URLs
 * remain byte-for-byte equivalent apart from adding the required protocol.
 */
export function normalizeApiBaseUrl(domain?: string): string | null {
  const input = domain?.trim();
  if (!input) return null;
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withProtocol);
    if (url.hostname.endsWith('.replit.dev') && url.hostname.includes('.expo.')) {
      url.hostname = url.hostname.replace('.expo.', '.');
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    // Environment values are hostnames in normal Expo use. Keep an invalid
    // custom value intact rather than applying a potentially unsafe rewrite.
    return withProtocol.replace(/\/+$/, '');
  }
}
// Web is served behind the Expo host's same-origin /api proxy. Native needs
// an absolute API host because relative fetch URLs have no document origin.
setBaseUrl(Platform.OS === 'web' ? null : normalizeApiBaseUrl(process.env.EXPO_PUBLIC_DOMAIN));
// SecureStore is native-only; web sessions must not persist beyond this tab.
const getToken = async () => Platform.OS === 'web'
  ? (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY))
  : SecureStore.getItemAsync(TOKEN_KEY);
const saveToken = async (value: string) => {
  if (Platform.OS === 'web') { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(TOKEN_KEY, value); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, value);
};
const clearToken = async () => {
  if (Platform.OS === 'web') { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};
const mobileAuthLifecycle = createMobileAuthLifecycle({ get: getToken, set: saveToken, remove: clearToken });
setAuthTokenGetter(getToken);

const requestHeaders = (id: string, signal?: AbortSignal) => ({ headers: { 'Idempotency-Key': id, 'X-Request-Id': id }, signal });
const requestId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
type HttpError = Error & { status?: number };
const httpStatus = (error: unknown) => typeof error === 'object' && error !== null && 'status' in error ? (error as HttpError).status : undefined;
const isNetworkFailure = (error: unknown) => httpStatus(error) === undefined;
const roleArabic: Record<StaffUser['role'], string> = {
  ADMIN: 'مدير النظام', MANAGER: 'مدير العمليات', DELEGATE: 'مندوب', SECURITY_OFFICER: 'مسؤول أمن',
};
export const getRoleArabic = (role: StaffUser['role']) => roleArabic[role];

function mapAid(aid: ApiAid): Aid {
  return {
    id: aid.id,
    title: aid.title,
    type: ({ FOOD: 'غذاء', WATER: 'مياه', MEDICAL: 'صحة', SHELTER: 'إيواء', HYGIENE: 'نظافة', OTHER: 'أخرى' } as Record<AidType, string>)[aid.type],
    families: aid.quantity,
    status: new Date(aid.distributionDate).getTime() < Date.now() ? 'مكتملة' : 'نشطة',
    date: new Date(aid.distributionDate).toLocaleDateString('ar'),
  };
}
function mapPerson(person: ApiPerson): Person {
  return { id: person.id, name: person.fullName, role: 'نازح', phone: person.phone || 'لا يوجد هاتف', location: `الخيمة ${person.tentNumber}` };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [tokenReady, setTokenReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [protectedHydrated, setProtectedHydrated] = useState(false);
  const [cache, setCache] = useState<Cache>(emptyCache);
  const [queue, setQueue] = useState<QueuedWrite[]>([]);
  const [manualError, setManualError] = useState('');
  const identityEpoch = useRef(0);
  const replayController = useRef<AbortController | null>(null);
  const activeOwner = useRef<string | null>(null);
  const rotateIdentity = useCallback(() => {
    identityEpoch.current += 1;
    replayController.current?.abort();
    replayController.current = null;
  }, []);

  useEffect(() => {
    mobileAuthLifecycle.restore()
      .then((savedToken) => {
        setToken(savedToken);
      })
      .catch(() => setManualError('تعذر تحميل البيانات المحفوظة على الجهاز.'))
      .finally(() => setTokenReady(true));
  }, []);

  const enabled = tokenReady && !!token;
  const me = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), enabled, retry: false } });
  const aidsQuery = useListAids({ query: { queryKey: getListAidsQueryKey(), enabled, retry: false } });
  const peopleQuery = useListPeople({ query: { queryKey: getListPeopleQueryKey(), enabled, retry: false } });
  const complaintsQuery = useListComplaints({ query: { queryKey: getListComplaintsQueryKey(), enabled, retry: false } });
  const tasksQuery = useListTasks({ query: { queryKey: getListTasksQueryKey(), enabled, retry: false } });
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const user = me.data ?? null;
  useEffect(() => {
    if (!user) return;
    const hydrationEpoch = identityEpoch.current;
    if (ownerUserId && ownerUserId !== user.id) {
      // A new authenticated account must never inherit another account's data.
      rotateIdentity();
      setCache(emptyCache); setQueue([]); setProtectedHydrated(false);
    }
    activeOwner.current = user.id;
    setOwnerUserId(user.id);
    setProtectedHydrated(false);
    loadOwnerStorage<Cache, QueuedWrite>(user.id, (key) => AsyncStorage.getItem(key))
      .then((stored) => {
        if (identityEpoch.current !== hydrationEpoch) return;
        if (stored.cache) setCache(stored.cache);
        setQueue(stored.queue);
      })
      .catch(() => setManualError('تعذر تحميل بيانات الحساب المحفوظة على الجهاز.'))
      .finally(() => {
        if (identityEpoch.current === hydrationEpoch) setProtectedHydrated(true);
      });
  }, [ownerUserId, rotateIdentity, user]);

  const serverCache = useMemo<Cache>(() => ({
    aids: aidsQuery.data ?? cache.aids,
    people: peopleQuery.data ?? cache.people,
    complaints: complaintsQuery.data ?? cache.complaints,
    tasks: tasksQuery.data ?? cache.tasks,
  }), [aidsQuery.data, cache, complaintsQuery.data, peopleQuery.data, tasksQuery.data]);

  useEffect(() => {
    if (!user || !protectedHydrated || (!aidsQuery.data && !peopleQuery.data && !complaintsQuery.data && !tasksQuery.data)) return;
    const next: Cache = {
      aids: aidsQuery.data ?? cache.aids,
      people: peopleQuery.data ?? cache.people,
      complaints: complaintsQuery.data ?? cache.complaints,
      tasks: tasksQuery.data ?? cache.tasks,
    };
    setCache(next);
    AsyncStorage.setItem(cacheStorageKey(user.id), JSON.stringify(next)).catch(() => setManualError('تمت المزامنة، لكن تعذر حفظ نسخة القراءة دون اتصال.'));
    // Query payload changes are the only trigger; including cache would repeatedly persist the same response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aidsQuery.data, complaintsQuery.data, peopleQuery.data, protectedHydrated, tasksQuery.data, user]);

  useEffect(() => {
    if (httpStatus(me.error) !== 401) return;
    rotateIdentity();
    mobileAuthLifecycle.logout().finally(() => {
      setToken(null);
      if (ownerUserId) void AsyncStorage.multiRemove([cacheStorageKey(ownerUserId), queueStorageKey(ownerUserId)]);
      activeOwner.current = null;
      setOwnerUserId(null); setProtectedHydrated(false); setCache(emptyCache); setQueue([]);
      queryClient.clear();
      setManualError('انتهت الجلسة. سجّل الدخول مجدداً.');
    });
  }, [me.error, ownerUserId, queryClient, rotateIdentity]);

  const saveQueueForOwner = useCallback(async (owner: string, next: QueuedWrite[]) => {
    const owned = next.filter((item) => item.ownerUserId === owner);
    await AsyncStorage.setItem(queueStorageKey(owner), JSON.stringify(owned));
    if (activeOwner.current !== owner) return;
    setQueue(owned);
  }, []);

  const saveQueue = useCallback(async (next: QueuedWrite[]) => {
    if (!ownerUserId) throw new Error('Cannot persist an offline queue without an owner');
    setQueue(next);
    await saveQueueForOwner(ownerUserId, next);
  }, [ownerUserId, saveQueueForOwner]);

  const refetchAll = useCallback(async () => {
    setManualError('');
    await mobileAuthLifecycle.synchronizedRefresh(async () => {
      await Promise.all([aidsQuery.refetch(), peopleQuery.refetch(), complaintsQuery.refetch(), tasksQuery.refetch()]);
    });
  }, [aidsQuery.refetch, complaintsQuery.refetch, peopleQuery.refetch, tasksQuery.refetch]);

  const replayQueue = useCallback(async () => {
    if (!token || !user || ownerUserId !== user.id || !protectedHydrated || queue.length === 0) return;
    replayController.current?.abort();
    const controller = new AbortController();
    replayController.current = controller;
    const epoch = identityEpoch.current;
    const replayOwner = user.id;
    let remaining = queue.filter((item) => item.ownerUserId === replayOwner);
    try {
      remaining = await replayOwnerQueue({
        ownerUserId: replayOwner,
        items: remaining,
        signal: controller.signal,
        isCurrent: () => identityEpoch.current === epoch && ownerUserId === replayOwner,
        execute: async (item, signal) => {
          if (item.kind === 'aid') await createAid(item.data, requestHeaders(item.id, signal));
          if (item.kind === 'person') await createPerson(item.data, requestHeaders(item.id, signal));
          if (item.kind === 'complaint') await updateComplaintStatus(item.targetId, { status: item.status, expectedVersion: item.expectedVersion }, requestHeaders(item.id, signal));
          if (item.kind === 'task') await updateTaskStatus(item.targetId, { status: item.status, expectedVersion: item.expectedVersion }, requestHeaders(item.id, signal));
        },
        persist: saveQueueForOwner,
      });
    } catch (error) {
      if (!controller.signal.aborted && httpStatus(error)) {
        setManualError(httpStatus(error) === 403 ? 'ليس لديك صلاحية لتنفيذ أحد الإجراءات المعلّقة.' : `تعذر إرسال إجراء معلّق: ${(error as Error).message}`);
      }
    }
    if (remaining.length === 0) await refetchAll();
  }, [ownerUserId, protectedHydrated, queue, refetchAll, saveQueueForOwner, token, user]);

  useEffect(() => { if (enabled && protectedHydrated && queue.length) void replayQueue(); }, [enabled, protectedHydrated]); // replay once after validated account hydration

  const queueOnNetworkError = useCallback(async (error: unknown, item: QueuedWrite, expectedEpoch: number): Promise<MutationResult> => {
    if (!isNetworkFailure(error)) {
      if (httpStatus(error) === 403) throw new Error('ليس لديك صلاحية لتنفيذ هذا الإجراء (403).');
      throw error;
    }
    if (!user || identityEpoch.current !== expectedEpoch || activeOwner.current !== user.id) {
      throw new Error('تغيّر الحساب قبل اكتمال الإجراء؛ لم تتم إضافته إلى قائمة الانتظار.');
    }
    await saveQueue([...queue, { ...item, ownerUserId: user.id } as QueuedWrite]);
    setManualError('الجهاز غير متصل. تم وضع الإجراء في قائمة الانتظار ولم تتم مزامنته بعد.');
    return { queued: true };
  }, [queue, saveQueue, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await loginMutation.mutateAsync({ data: { email, password } });
    rotateIdentity();
    if (ownerUserId) {
      await AsyncStorage.multiRemove([cacheStorageKey(ownerUserId), queueStorageKey(ownerUserId)]);
      activeOwner.current = null;
      setCache(emptyCache); setQueue([]); setOwnerUserId(null); setProtectedHydrated(false);
    }
    // Remove all user-scoped React Query results before accepting a different
    // bearer token, preventing a brief cross-account render.
    queryClient.clear();
    await mobileAuthLifecycle.login(session.token);
    setToken(session.token);
    // Do not trust the login payload as the active identity: /auth/me must
    // validate the token before protected data is hydrated or rendered.
    void queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
    setManualError('');
  }, [loginMutation, ownerUserId, queryClient, rotateIdentity]);

  const signOut = useCallback(async () => {
    rotateIdentity();
    try { await logoutMutation.mutateAsync(); } catch { /* local logout must still revoke local credentials */ }
    await mobileAuthLifecycle.logout();
    setToken(null);
    if (ownerUserId) await AsyncStorage.multiRemove([cacheStorageKey(ownerUserId), queueStorageKey(ownerUserId)]);
    activeOwner.current = null;
    setOwnerUserId(null); setProtectedHydrated(false);
    setCache(emptyCache);
    setQueue([]);
    queryClient.clear();
  }, [logoutMutation, ownerUserId, queryClient, rotateIdentity]);

  const manager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const delegate = user?.role === 'DELEGATE';
  const security = user?.role === 'SECURITY_OFFICER';
  const queries = [me, aidsQuery, peopleQuery, complaintsQuery, tasksQuery];
  const fetching = queries.some((query) => query.isFetching);
  const queryError = queries.find((query) => query.error)?.error;
  const syncState: SyncState = fetching ? 'syncing' : queryError && isNetworkFailure(queryError) ? 'offline' : queryError || manualError ? 'error' : 'synced';
  const syncMessage = queue.length ? `${queue.length} إجراء بانتظار المزامنة` :
    syncState === 'syncing' ? 'جارٍ مزامنة بيانات الفريق…' :
    syncState === 'offline' ? 'غير متصل — تُعرض آخر نسخة محفوظة' :
    syncState === 'error' ? (manualError || 'تعذرت المزامنة. اسحب للتحديث أو أعد المحاولة.') : 'متزامن مع خادم الفريق';

  const value = useMemo<AppValue>(() => ({
    signedIn: !!user,
    authLoading: !!token && !user,
    user,
    aids: serverCache.aids.map(mapAid),
    people: serverCache.people.map(mapPerson),
    complaints: serverCache.complaints,
    tasks: serverCache.tasks,
    syncState,
    syncMessage,
    queuedCount: queue.length,
    pendingWrites: queue,
    canManageAids: !!user && (manager || delegate),
    canManagePeople: !!user && (manager || delegate),
    canManageComplaints: !!user && (manager || delegate),
    canManageTasks: !!user && (manager || security),
    signIn,
    signOut,
    addAid: async (data) => {
      const id = requestId();
      const epoch = identityEpoch.current;
      try {
        // The identical key is persisted with the queued write below, so a
        // response-lost retry is deduplicated by the server.
        await createAid(data, requestHeaders(id));
        await queryClient.invalidateQueries({ queryKey: getListAidsQueryKey() });
        return { queued: false };
      } catch (error) { return queueOnNetworkError(error, { id, ownerUserId: user?.id || '', kind: 'aid', data }, epoch); }
    },
    addPerson: async (data) => {
      const id = requestId();
      const epoch = identityEpoch.current;
      try {
        // Use the same key for the first attempt and any queued replay.
        await createPerson(data, requestHeaders(id));
        await queryClient.invalidateQueries({ queryKey: getListPeopleQueryKey() });
        return { queued: false };
      } catch (error) { return queueOnNetworkError(error, { id, ownerUserId: user?.id || '', kind: 'person', data }, epoch); }
    },
    setComplaintStatus: async (id, status, expectedVersion) => {
      const writeId = requestId();
      const epoch = identityEpoch.current;
      try {
        await updateComplaintStatus(id, { status, expectedVersion }, requestHeaders(writeId));
        await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        return { queued: false };
      } catch (error) { return queueOnNetworkError(error, { id: writeId, ownerUserId: user?.id || '', kind: 'complaint', targetId: id, status, expectedVersion }, epoch); }
    },
    setTaskStatus: async (id, status, expectedVersion) => {
      const writeId = requestId();
      const epoch = identityEpoch.current;
      try {
        await updateTaskStatus(id, { status, expectedVersion }, requestHeaders(writeId));
        await queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        return { queued: false };
      } catch (error) { return queueOnNetworkError(error, { id: writeId, ownerUserId: user?.id || '', kind: 'task', targetId: id, status, expectedVersion }, epoch); }
    },
    retrySync: async () => { await replayQueue(); await refetchAll(); },
    discardQueuedWrite: async (id) => saveQueue(queue.filter((item) => item.id !== id)),
  }), [delegate, manager, queryClient, queue, queueOnNetworkError, refetchAll, replayQueue, saveQueue, security, serverCache, signIn, signOut, syncMessage, syncState, token, user]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}