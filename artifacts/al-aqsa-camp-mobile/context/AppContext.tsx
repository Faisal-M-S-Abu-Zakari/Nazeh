import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  type Aid as ApiAid, type AidType, type Complaint, type ComplaintInput, type ComplaintStatus,
  type CreateAidRequest, type CreatePersonRequest, type Person as ApiPerson, type StaffUser,
  type FamilyHeadNeed, type FamilyHeadNeedInput, type FamilyHeadProfile, type FamilyReceivedAid,
  type Task, type TaskInput, type TaskStatus, createAid, createPerson, createSyncComplaint,
  createFamilyMeNeed, createSyncTask, customFetch, getGetCurrentUserQueryKey, getGetFamilyMeNeedsQueryKey,
  getGetFamilyMeQueryKey, getGetFamilyMeAidDistributionsQueryKey, getListAidsQueryKey, getListComplaintsQueryKey,
  getListPeopleQueryKey, getListTasksQueryKey, setAuthTokenGetter, setBaseUrl,
  updateComplaintStatus, updateTaskStatus, useGetCurrentUser, useGetFamilyMe, useGetFamilyMeNeeds, useGetFamilyMeAidDistributions, useListAids, useListComplaints,
  useListPeople, useListTasks, useLogin, useLogout,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { cacheStorageKey, createMobileAuthLifecycle, loadOwnerStorage, queueStorageKey, replayOwnerQueue } from './offlineSync';
import { preserveSnapshotIdentity } from './cacheSnapshot';
import { getReceivedDistributionCount, selectLatestAids } from '@/lib/aidPresentation';
import { getLastSuccessfulAidsSyncAt, retryAidList } from '@/lib/aidSyncPresentation';
import { selectLatestPeople } from '@/lib/personPresentation';
import { getLastSuccessfulPeopleSyncAt, getPeopleSyncPresentation } from '@/lib/peopleSyncPresentation';
import { canReadTeamTasks } from '@/lib/taskSyncAccess';
import { getMutationErrorMessage, getErrorStatus, isVersionConflict } from '@/lib/mutationErrors';

export type Aid = { id: string; title: string; type: string; apiType: AidType; families: number; receivedDistributionCount: number; unit: string; location: string; distributionDate: string; notes?: string | null; version: number; status: 'نشطة' | 'مكتملة'; date: string };
export type Person = { id: string; name: string; role: 'نازح'; phone: string; nationalId: string; gender: ApiPerson['gender']; birthDate: string; tentNumber: string; familySize: number; notes?: string | null; version: number; location: string };
export type SyncState = 'syncing' | 'synced' | 'offline' | 'error';
export type AppUser = StaffUser | (Omit<FamilyHeadProfile['headUser'], 'id' | 'role'> & { id: string; role: 'DISPLACED' });
type Cache = { aids: ApiAid[]; people: ApiPerson[]; complaints: Complaint[]; tasks: Task[]; familyProfile?: FamilyHeadProfile; familyNeeds?: FamilyHeadNeed[]; receivedAids?: FamilyReceivedAid[]; lastReceivedAidsSyncAt?: string | null; lastAidsSyncAt?: string | null; lastPeopleSyncAt?: string | null };
type QueuedWrite =
  | { id: string; idempotencyKey: string; ownerUserId: string; kind: 'aid'; data: CreateAidRequest }
  | { id: string; idempotencyKey: string; ownerUserId: string; kind: 'person'; data: CreatePersonRequest }
  | { id: string; idempotencyKey: string; ownerUserId: string; kind: 'complaint-create'; data: ComplaintInput }
  | { id: string; idempotencyKey: string; ownerUserId: string; kind: 'task-create'; data: TaskInput }
  | { id: string; ownerUserId: string; kind: 'complaint'; targetId: string; status: ComplaintStatus; expectedVersion: number }
  | { id: string; ownerUserId: string; kind: 'task'; targetId: string; status: TaskStatus; expectedVersion: number; conflict?: { refreshed: boolean; title: string | null; status: TaskStatus | null; version: number | null } }
  | { id: string; idempotencyKey: string; ownerUserId: string; kind: 'family-need'; data: FamilyHeadNeedInput };
type MutationResult = { queued: boolean };
type AppValue = {
  signedIn: boolean; authLoading: boolean; user: AppUser | null; familyProfile: FamilyHeadProfile | null; familyNeeds: FamilyHeadNeed[];
  receivedAids: FamilyReceivedAid[]; receivedAidsLoading: boolean; receivedAidsError: boolean; receivedAidsHasSnapshot: boolean;
  lastReceivedAidsSyncAt: string | null; retryReceivedAids: () => Promise<void>;
  signedInAsFamilyHead: boolean; aids: Aid[]; people: Person[];
  complaints: Complaint[]; tasks: Task[]; syncState: SyncState; syncMessage: string; queuedCount: number;
  aidsSyncState: SyncState; aidsSyncMessage: string; lastAidsSyncAt: string | null; retryAids: () => Promise<void>;
  peopleSyncState: SyncState; peopleSyncMessage: string; lastPeopleSyncAt: string | null; retryPeople: () => Promise<void>;
  pendingWrites: QueuedWrite[]; canManageAids: boolean; canManagePeople: boolean;
  canManageComplaints: boolean; canManageTasks: boolean;
  signIn: (email: string, password: string, accountType?: 'staff' | 'family') => Promise<void>; signOut: () => Promise<void>;
  addAid: (data: CreateAidRequest) => Promise<MutationResult>; addPerson: (data: CreatePersonRequest) => Promise<MutationResult>;
  addComplaint: (data: ComplaintInput) => Promise<MutationResult>; addTask: (data: TaskInput) => Promise<MutationResult>;
  addFamilyNeed: (data: FamilyHeadNeedInput) => Promise<MutationResult>;
  setComplaintStatus: (id: string, status: ComplaintStatus, expectedVersion: number) => Promise<MutationResult>;
  setTaskStatus: (id: string, status: TaskStatus, expectedVersion: number) => Promise<MutationResult>;
  retrySync: () => Promise<void>; discardQueuedWrite: (id: string) => Promise<void>; reviewTaskConflict: (id: string) => Promise<void>;
};

const AppContext = createContext<AppValue | null>(null);
const TOKEN_KEY = 'al-aqsa-auth-token';
const ROLE_KEY = 'al-aqsa-auth-role';
const USER_KEY = 'al-aqsa-family-user';
const emptyCache: Cache = { aids: [], people: [], complaints: [], tasks: [], familyNeeds: [] };

// Keep only the read-only aid history on a shared device. The family profile
// contains identifiers and medical notes and must not survive logout.
function familyReadSnapshot(cache: Cache): Cache {
  return {
    ...emptyCache,
    receivedAids: cache.receivedAids,
    lastReceivedAidsSyncAt: cache.lastReceivedAidsSyncAt,
  };
}

export function normalizeApiBaseUrl(domain?: string): string | null {
  const input = domain?.trim();
  if (!input) return null;
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withProtocol);
    if (url.hostname.endsWith('.replit.dev') && url.hostname.includes('.expo.')) url.hostname = url.hostname.replace('.expo.', '.');
    return url.toString().replace(/\/+$/, '');
  } catch { return withProtocol.replace(/\/+$/, ''); }
}
setBaseUrl(Platform.OS === 'web' ? null : normalizeApiBaseUrl(process.env.EXPO_PUBLIC_DOMAIN));
const getToken = async () => Platform.OS === 'web' ? (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY)) : SecureStore.getItemAsync(TOKEN_KEY);
const saveToken = async (value: string) => {
  if (Platform.OS === 'web') { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(TOKEN_KEY, value); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, value);
};
const clearToken = async () => {
  if (Platform.OS === 'web') { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};
const getRole = async () => Platform.OS === 'web' ? (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(ROLE_KEY)) : SecureStore.getItemAsync(ROLE_KEY);
const saveRole = async (role: string) => Platform.OS === 'web' ? sessionStorage.setItem(ROLE_KEY, role) : SecureStore.setItemAsync(ROLE_KEY, role);
const clearRole = async () => Platform.OS === 'web' ? sessionStorage.removeItem(ROLE_KEY) : SecureStore.deleteItemAsync(ROLE_KEY);
const getStoredFamilyUser = async (): Promise<AppUser | null> => {
  const value = Platform.OS === 'web' ? (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(USER_KEY)) : await SecureStore.getItemAsync(USER_KEY);
  if (!value) return null;
  try { return JSON.parse(value) as AppUser; } catch { return null; }
};
const saveStoredFamilyUser = async (user: AppUser) => Platform.OS === 'web' ? sessionStorage.setItem(USER_KEY, JSON.stringify(user)) : SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
const clearStoredFamilyUser = async () => Platform.OS === 'web' ? sessionStorage.removeItem(USER_KEY) : SecureStore.deleteItemAsync(USER_KEY);
const mobileAuthLifecycle = createMobileAuthLifecycle({ get: getToken, set: saveToken, remove: clearToken });
setAuthTokenGetter(getToken);
const requestId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const requestHeaders = (id: string, signal?: AbortSignal) => ({ headers: { 'Idempotency-Key': id, 'X-Request-Id': id }, signal });
type HttpError = Error & { status?: number };
const httpStatus = (error: unknown) => typeof error === 'object' && error !== null && 'status' in error ? (error as HttpError).status : undefined;
const isNetworkFailure = (error: unknown) => httpStatus(error) === undefined;
const roleArabic: Record<string, string> = { ADMIN: 'مدير النظام', MANAGER: 'مدير العمليات', DELEGATE: 'مندوب', SECURITY_OFFICER: 'مسؤول أمن', SECURITY_MEMBER: 'عضو أمن', DISPLACED: 'رب الأسرة' };
export const getRoleArabic = (role: string) => roleArabic[role] ?? role;

function hydrateQueue(entries: unknown, userId: string): QueuedWrite[] {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry): QueuedWrite[] => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Partial<QueuedWrite> & { id?: unknown; ownerUserId?: unknown; kind?: unknown };
    if (item.ownerUserId !== userId || typeof item.id !== 'string') return [];
    if (item.kind === 'aid' || item.kind === 'person' || item.kind === 'complaint-create' || item.kind === 'task-create' || item.kind === 'family-need') {
      return [{ ...item, idempotencyKey: typeof item.idempotencyKey === 'string' ? item.idempotencyKey : item.id } as QueuedWrite];
    }
    return item.kind === 'complaint' || item.kind === 'task' ? [item as QueuedWrite] : [];
  });
}
function mapAid(aid: ApiAid): Aid {
  return { id: aid.id, title: aid.title, type: ({ FOOD: 'غذاء', WATER: 'مياه', MEDICAL: 'صحة', SHELTER: 'إيواء', HYGIENE: 'نظافة', OTHER: 'أخرى' } as Record<AidType, string>)[aid.type], apiType: aid.type, families: aid.quantity, receivedDistributionCount: getReceivedDistributionCount(aid), unit: aid.unit, location: aid.location, distributionDate: aid.distributionDate, notes: aid.notes, version: aid.version, status: new Date(aid.distributionDate).getTime() < Date.now() ? 'مكتملة' : 'نشطة', date: new Date(aid.distributionDate).toLocaleDateString('ar') };
}
function mapPerson(person: ApiPerson): Person {
  return { id: person.id, name: person.fullName, role: 'نازح', phone: person.phone || 'لا يوجد هاتف', nationalId: person.nationalId, gender: person.gender, birthDate: person.birthDate, tentNumber: person.tentNumber, familySize: person.familySize, notes: person.notes, version: person.version, location: `الخيمة ${person.tentNumber}` };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [tokenReady, setTokenReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [storedFamilyUser, setStoredFamilyUser] = useState<AppUser | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [protectedHydrated, setProtectedHydrated] = useState(false);
  const [cache, setCache] = useState<Cache>(emptyCache);
  const [lastAidsSyncAt, setLastAidsSyncAt] = useState<string | null>(null);
  const [storedLastPeopleSyncAt, setStoredLastPeopleSyncAt] = useState<string | null>(null);
  const [hasLocalPeopleCache, setHasLocalPeopleCache] = useState(false);
  const [queue, setQueue] = useState<QueuedWrite[]>([]);
  const [manualError, setManualError] = useState('');
  const identityEpoch = useRef(0);
  const replayController = useRef<AbortController | null>(null);
  const activeOwner = useRef<string | null>(null);
  const rotateIdentity = useCallback(() => { identityEpoch.current += 1; replayController.current?.abort(); replayController.current = null; }, []);

  useEffect(() => { Promise.all([mobileAuthLifecycle.restore(), getRole(), getStoredFamilyUser()]).then(([storedToken, storedRole, storedUser]) => { setToken(storedToken); setAuthRole(storedRole); setStoredFamilyUser(storedUser); }).catch(() => setManualError('تعذر تحميل البيانات المحفوظة على الجهاز.')).finally(() => setTokenReady(true)); }, []);
  const enabled = tokenReady && !!token;
  const staffEnabled = enabled && authRole !== 'displaced';
  const familyEnabled = enabled && authRole === 'displaced';
  const taskSyncEnabled = staffEnabled && canReadTeamTasks(authRole);
  const me = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), enabled: staffEnabled, retry: false } });
  const familyProfileQuery = useGetFamilyMe({ query: { queryKey: getGetFamilyMeQueryKey(), enabled: familyEnabled, retry: false } });
  const familyNeedsQuery = useGetFamilyMeNeeds({ query: { queryKey: getGetFamilyMeNeedsQueryKey(), enabled: familyEnabled, retry: false } });
  const receivedAidsQuery = useGetFamilyMeAidDistributions({
    query: { queryKey: [...getGetFamilyMeAidDistributionsQueryKey(), storedFamilyUser?.id], enabled: familyEnabled && !!storedFamilyUser?.id, retry: false },
  });
  const aidsQuery = useListAids({ query: { queryKey: getListAidsQueryKey(), enabled: staffEnabled, retry: false } });
  const peopleQuery = useListPeople({ query: { queryKey: getListPeopleQueryKey(), enabled: staffEnabled, retry: false } });
  const lastPeopleSyncAt = getLastSuccessfulPeopleSyncAt(storedLastPeopleSyncAt, peopleQuery.dataUpdatedAt);
  const complaintsQuery = useListComplaints({ query: { queryKey: getListComplaintsQueryKey(), enabled: staffEnabled, retry: false } });
  const tasksQuery = useListTasks({ query: { queryKey: getListTasksQueryKey(), enabled: taskSyncEnabled, retry: false } });
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const user: AppUser | null = authRole === 'displaced'
    ? familyProfileQuery.data ? { ...familyProfileQuery.data.headUser, id: String(familyProfileQuery.data.headUser.id), role: 'DISPLACED' } : cache.familyProfile ? { ...cache.familyProfile.headUser, id: String(cache.familyProfile.headUser.id), role: 'DISPLACED' } : storedFamilyUser
    : me.data ?? null;

  useEffect(() => {
    if (!user || ownerUserId === user.id) return;
    if (ownerUserId && ownerUserId !== user.id) { rotateIdentity(); setCache(emptyCache); setLastAidsSyncAt(null); setStoredLastPeopleSyncAt(null); setHasLocalPeopleCache(false); setQueue([]); setProtectedHydrated(false); }
    const hydrationEpoch = identityEpoch.current;
    activeOwner.current = user.id;
    setOwnerUserId(user.id); setProtectedHydrated(false);
    loadOwnerStorage<Cache, QueuedWrite>(user.id, (key) => AsyncStorage.getItem(key))
      .then((stored) => {
        if (identityEpoch.current !== hydrationEpoch) return;
        if (stored.cache) setCache(stored.cache);
        setLastAidsSyncAt(stored.cache?.lastAidsSyncAt ?? null);
        setStoredLastPeopleSyncAt(stored.cache?.lastPeopleSyncAt ?? null);
        setHasLocalPeopleCache(Array.isArray(stored.cache?.people));
        setQueue(hydrateQueue(stored.queue, user.id));
      })
      .catch(() => setManualError('تعذر تحميل بيانات الحساب المحفوظة على الجهاز.'))
      .finally(() => { if (identityEpoch.current === hydrationEpoch) setProtectedHydrated(true); });
  }, [ownerUserId, rotateIdentity, user?.id]);

  const receivedAidsOwnerReady = familyEnabled && !!storedFamilyUser?.id && ownerUserId === storedFamilyUser.id && user?.id === ownerUserId && protectedHydrated;
  const lastReceivedAidsSyncAt = receivedAidsOwnerReady
    ? receivedAidsQuery.data !== undefined && receivedAidsQuery.dataUpdatedAt
      ? new Date(receivedAidsQuery.dataUpdatedAt).toISOString()
      : cache.lastReceivedAidsSyncAt ?? null
    : null;
  const serverCache = useMemo<Cache>(() => ({ aids: selectLatestAids(aidsQuery.data, cache.aids), people: selectLatestPeople(peopleQuery.data, cache.people), complaints: complaintsQuery.data ?? cache.complaints, tasks: tasksQuery.data ?? cache.tasks, familyProfile: familyProfileQuery.data ?? cache.familyProfile, familyNeeds: familyNeedsQuery.data ?? cache.familyNeeds, receivedAids: receivedAidsQuery.data ?? cache.receivedAids, lastReceivedAidsSyncAt, lastAidsSyncAt }), [aidsQuery.data, cache, complaintsQuery.data, familyNeedsQuery.data, lastAidsSyncAt, lastReceivedAidsSyncAt, peopleQuery.data, receivedAidsQuery.data, tasksQuery.data]);
  useEffect(() => {
    if (!user || ownerUserId !== user.id || activeOwner.current !== user.id || !protectedHydrated || (familyEnabled && storedFamilyUser?.id !== user.id) || (!aidsQuery.data && !peopleQuery.data && !complaintsQuery.data && !tasksQuery.data && !familyProfileQuery.data && !familyNeedsQuery.data && !receivedAidsQuery.data)) return;
    const next: Cache = { aids: aidsQuery.data ?? cache.aids, people: selectLatestPeople(peopleQuery.data, cache.people), complaints: complaintsQuery.data ?? cache.complaints, tasks: tasksQuery.data ?? cache.tasks, familyProfile: familyProfileQuery.data ?? cache.familyProfile, familyNeeds: familyNeedsQuery.data ?? cache.familyNeeds, receivedAids: receivedAidsQuery.data ?? cache.receivedAids, lastReceivedAidsSyncAt, lastAidsSyncAt };
    setCache((current) => preserveSnapshotIdentity(current, { ...next, lastPeopleSyncAt }));
    if (peopleQuery.data !== undefined) setHasLocalPeopleCache(true);
    AsyncStorage.setItem(cacheStorageKey(user.id), JSON.stringify({ ...next, lastPeopleSyncAt })).catch(() => setManualError('تمت المزامنة، لكن تعذر حفظ نسخة القراءة دون اتصال.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aidsQuery.data, complaintsQuery.data, familyNeedsQuery.data, familyProfileQuery.data, lastAidsSyncAt, lastPeopleSyncAt, lastReceivedAidsSyncAt, peopleQuery.data, protectedHydrated, receivedAidsQuery.data, tasksQuery.data, user?.id]);
  useEffect(() => {
    if (!user || !protectedHydrated || !aidsQuery.data || !aidsQuery.dataUpdatedAt) return;
    setLastAidsSyncAt((current) => getLastSuccessfulAidsSyncAt(current, aidsQuery.dataUpdatedAt));
  }, [aidsQuery.data, aidsQuery.dataUpdatedAt, protectedHydrated, user]);
  useEffect(() => {
    if (!user || !protectedHydrated || peopleQuery.data === undefined || !peopleQuery.dataUpdatedAt) return;
    setStoredLastPeopleSyncAt((current) => getLastSuccessfulPeopleSyncAt(current, peopleQuery.dataUpdatedAt));
  }, [peopleQuery.data, peopleQuery.dataUpdatedAt, protectedHydrated, user]);
  useEffect(() => {
    if (authRole === 'displaced' || httpStatus(me.error) !== 401) return;
    rotateIdentity();
    mobileAuthLifecycle.logout().finally(() => {
      setToken(null); if (ownerUserId) void AsyncStorage.multiRemove([cacheStorageKey(ownerUserId), queueStorageKey(ownerUserId)]);
      activeOwner.current = null; setOwnerUserId(null); setProtectedHydrated(false); setCache(emptyCache); setLastAidsSyncAt(null); setStoredLastPeopleSyncAt(null); setHasLocalPeopleCache(false); setQueue([]); queryClient.clear(); setManualError('انتهت الجلسة. سجّل الدخول مجدداً.');
    });
  }, [authRole, me.error, ownerUserId, queryClient, rotateIdentity]);

  const saveQueueForOwner = useCallback(async (owner: string, next: QueuedWrite[]) => {
    const owned = next.filter((item) => item.ownerUserId === owner);
    await AsyncStorage.setItem(queueStorageKey(owner), JSON.stringify(owned));
    if (activeOwner.current === owner) setQueue(owned);
  }, []);
  const saveQueue = useCallback(async (next: QueuedWrite[]) => {
    if (!ownerUserId) throw new Error('Cannot persist an offline queue without an owner');
    await saveQueueForOwner(ownerUserId, next);
  }, [ownerUserId, saveQueueForOwner]);
  const refetchAll = useCallback(async () => {
    setManualError('');
    await mobileAuthLifecycle.synchronizedRefresh(async () => { await Promise.all([aidsQuery.refetch(), peopleQuery.refetch(), complaintsQuery.refetch(), ...(taskSyncEnabled ? [tasksQuery.refetch()] : []), familyProfileQuery.refetch(), familyNeedsQuery.refetch(), ...(familyEnabled ? [receivedAidsQuery.refetch()] : [])]); });
  }, [aidsQuery.refetch, complaintsQuery.refetch, familyEnabled, familyNeedsQuery.refetch, familyProfileQuery.refetch, peopleQuery.refetch, receivedAidsQuery.refetch, taskSyncEnabled, tasksQuery.refetch]);
  const retryAids = useCallback(async () => {
    await retryAidList(mobileAuthLifecycle.synchronizedRefresh, aidsQuery.refetch);
  }, [aidsQuery.refetch]);
  const retryPeople = useCallback(async () => {
    await mobileAuthLifecycle.synchronizedRefresh(async () => { await peopleQuery.refetch(); });
  }, [peopleQuery.refetch]);
  const retryReceivedAids = useCallback(async () => {
    await mobileAuthLifecycle.synchronizedRefresh(async () => { await receivedAidsQuery.refetch(); });
  }, [receivedAidsQuery.refetch]);
  const invalidateFor = useCallback(async (item: QueuedWrite) => {
    if (item.kind === 'aid') await queryClient.invalidateQueries({ queryKey: getListAidsQueryKey() });
    if (item.kind === 'person') await queryClient.invalidateQueries({ queryKey: getListPeopleQueryKey() });
    if (item.kind === 'complaint' || item.kind === 'complaint-create') await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
    if (item.kind === 'task' || item.kind === 'task-create') await queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    if (item.kind === 'family-need') await queryClient.invalidateQueries({ queryKey: getGetFamilyMeNeedsQueryKey() });
  }, [queryClient]);
  const replayQueue = useCallback(async () => {
    if (!token || !user || ownerUserId !== user.id || !protectedHydrated || !queue.length) return;
    replayController.current?.abort();
    const controller = new AbortController(); replayController.current = controller;
    const epoch = identityEpoch.current; const replayOwner = user.id;
    let remaining = queue.filter((item) => item.ownerUserId === replayOwner);
    try {
      remaining = await replayOwnerQueue({
        ownerUserId: replayOwner, items: remaining, signal: controller.signal,
        isCurrent: () => identityEpoch.current === epoch && activeOwner.current === replayOwner,
        execute: async (item, signal) => {
          const key = 'idempotencyKey' in item ? item.idempotencyKey : item.id;
          if (item.kind === 'aid') await createAid(item.data, requestHeaders(key, signal));
          if (item.kind === 'person') await createPerson(item.data, requestHeaders(key, signal));
          if (item.kind === 'complaint-create') await createSyncComplaint(item.data, requestHeaders(key, signal));
          if (item.kind === 'task-create') await createSyncTask(item.data, requestHeaders(key, signal));
          if (item.kind === 'family-need') await createFamilyMeNeed(item.data, requestHeaders(key, signal));
          if (item.kind === 'complaint') await updateComplaintStatus(item.targetId, { status: item.status, expectedVersion: item.expectedVersion }, requestHeaders(key, signal));
          if (item.kind === 'task') await updateTaskStatus(item.targetId, { status: item.status, expectedVersion: item.expectedVersion }, requestHeaders(key, signal));
          await invalidateFor(item);
        },
        isConflict: (item, error) => item.kind === 'task' && isVersionConflict(error),
        markConflict: async (item) => {
          if (item.kind !== 'task') return item;
          const refreshed = await tasksQuery.refetch();
          const latest = refreshed.isError ? undefined : refreshed.data?.find((task) => task.id === item.targetId);
          return {
            ...item,
            conflict: {
              refreshed: !refreshed.isError && refreshed.data !== undefined,
              title: latest?.title ?? null,
              status: latest?.status ?? null,
              version: latest?.version ?? null,
            },
          };
        },
        isBlocked: (item) => item.kind === 'task' && !!item.conflict,
        persist: saveQueueForOwner,
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        const status = getErrorStatus(error);
        if (status === 401 || status === 403) setManualError('ليس لديك صلاحية لتنفيذ أحد الإجراءات المعلّقة.');
        else if (status === undefined) setManualError('تعذر الاتصال بالخادم. بقيت الإجراءات غير المتعارضة بانتظار المزامنة.');
        else if (isVersionConflict(error)) setManualError('تعارض تحديث. راجع أحدث حالة للسجل قبل إنشاء إجراء جديد.');
        else setManualError(getMutationErrorMessage(error));
      }
    }
    if (remaining.length === 0) await refetchAll();
  }, [invalidateFor, ownerUserId, protectedHydrated, queue, refetchAll, saveQueueForOwner, tasksQuery.refetch, token, user]);
  useEffect(() => { if (enabled && protectedHydrated && queue.length) void replayQueue(); }, [enabled, protectedHydrated]); // replay after validated owner hydration
  const queueOnNetworkError = useCallback(async (error: unknown, item: QueuedWrite, expectedEpoch: number): Promise<MutationResult> => {
    if (!isNetworkFailure(error)) { if (httpStatus(error) === 403) throw new Error('ليس لديك صلاحية لتنفيذ هذا الإجراء (403).'); throw error; }
    if (!user || identityEpoch.current !== expectedEpoch || activeOwner.current !== user.id) throw new Error('تغيّر الحساب قبل اكتمال الإجراء؛ لم تتم إضافته إلى قائمة الانتظار.');
    await saveQueue([...queue, { ...item, ownerUserId: user.id } as QueuedWrite]);
    setManualError('الجهاز غير متصل. تم وضع الإجراء في قائمة الانتظار ولم تتم مزامنته بعد.');
    return { queued: true };
  }, [queue, saveQueue, user]);
  const signIn = useCallback(async (email: string, password: string, accountType: 'staff' | 'family' = 'staff') => {
    const session = accountType === 'family'
      ? await customFetch<{ token: string; user: { id: number; name: string; email: string; role: string; phone: string | null; createdAt: string } }>('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, role: 'displaced' }) })
      : await loginMutation.mutateAsync({ data: { email, password } });
    rotateIdentity();
    if (ownerUserId) {
      if (authRole === 'displaced') {
        await AsyncStorage.setItem(cacheStorageKey(ownerUserId), JSON.stringify(familyReadSnapshot(cache)));
        await AsyncStorage.removeItem(queueStorageKey(ownerUserId));
      } else await AsyncStorage.multiRemove([cacheStorageKey(ownerUserId), queueStorageKey(ownerUserId)]);
      activeOwner.current = null; setCache(emptyCache); setLastAidsSyncAt(null); setStoredLastPeopleSyncAt(null); setHasLocalPeopleCache(false); setQueue([]); setOwnerUserId(null); setProtectedHydrated(false);
    }
    queryClient.clear(); await mobileAuthLifecycle.login(session.token); await saveRole(accountType === 'family' ? 'displaced' : session.user.role); setAuthRole(accountType === 'family' ? 'displaced' : session.user.role); if (accountType === 'family') { const familyUser = { ...session.user, id: String(session.user.id), role: 'DISPLACED' as const }; await saveStoredFamilyUser(familyUser); setStoredFamilyUser(familyUser); } setToken(session.token); void queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setManualError('');
  }, [authRole, cache, loginMutation, ownerUserId, queryClient, rotateIdentity]);
  const signOut = useCallback(async () => {
    rotateIdentity(); try { await logoutMutation.mutateAsync(); } catch { /* local logout must still clear credentials */ }
    await mobileAuthLifecycle.logout(); await clearRole(); await clearStoredFamilyUser(); setToken(null); setAuthRole(null); setStoredFamilyUser(null);
    if (ownerUserId) {
      if (authRole === 'displaced') {
        await AsyncStorage.setItem(cacheStorageKey(ownerUserId), JSON.stringify(familyReadSnapshot(cache)));
        await AsyncStorage.removeItem(queueStorageKey(ownerUserId));
      } else await AsyncStorage.multiRemove([cacheStorageKey(ownerUserId), queueStorageKey(ownerUserId)]);
    }
    activeOwner.current = null; setOwnerUserId(null); setProtectedHydrated(false); setCache(emptyCache); setLastAidsSyncAt(null); setStoredLastPeopleSyncAt(null); setHasLocalPeopleCache(false); setQueue([]); queryClient.clear();
  }, [authRole, cache, logoutMutation, ownerUserId, queryClient, rotateIdentity]);
  const reviewTaskConflict = useCallback(async (id: string) => {
    const item = queue.find((write) => write.id === id && write.kind === 'task' && !!write.conflict);
    if (!item) return;
    const refreshed = await tasksQuery.refetch();
    if (refreshed.isError || refreshed.data === undefined) throw refreshed.error ?? new Error('Task refresh failed');
    await saveQueue(queue.filter((write) => write.id !== id));
  }, [queue, saveQueue, tasksQuery.refetch]);

  const manager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const delegate = user?.role === 'DELEGATE';
  const security = user?.role === 'SECURITY_OFFICER';
  const queries = [me, aidsQuery, peopleQuery, complaintsQuery, ...(taskSyncEnabled ? [tasksQuery] : []), familyProfileQuery, familyNeedsQuery, receivedAidsQuery];
  const queryError = queries.find((query) => query.error)?.error;
  const syncState: SyncState = queries.some((query) => query.isFetching) ? 'syncing' : queryError && isNetworkFailure(queryError) ? 'offline' : queryError || manualError ? 'error' : 'synced';
  const conflictedTaskCount = queue.filter((item) => item.kind === 'task' && !!item.conflict).length;
  const syncMessage = conflictedTaskCount ? `${conflictedTaskCount} مهمة تغيّرت على الخادم. راجع أحدث حالة من الحساب قبل إجراء تغيير جديد.` : manualError || (queue.length ? `${queue.length} إجراء بانتظار المزامنة` : syncState === 'syncing' ? 'جارٍ مزامنة بيانات الفريق…' : syncState === 'offline' ? 'غير متصل — تُعرض آخر نسخة محفوظة' : syncState === 'error' ? 'تعذرت المزامنة. اسحب للتحديث أو أعد المحاولة.' : 'متزامن مع خادم الفريق');
  const aidsSyncState: SyncState = aidsQuery.isFetching ? 'syncing' : aidsQuery.error && isNetworkFailure(aidsQuery.error) ? 'offline' : aidsQuery.error ? 'error' : 'synced';
  const aidsSyncMessage = aidsSyncState === 'syncing' ? 'جارٍ تحديث بيانات المساعدات…' : aidsSyncState === 'offline' ? 'تعذر الاتصال بخادم المساعدات' : aidsSyncState === 'error' ? 'تعذر تحديث بيانات المساعدات' : 'بيانات المساعدات متزامنة';
  const peopleSync = getPeopleSyncPresentation({
    isFetching: peopleQuery.isFetching,
    hasServerData: peopleQuery.data !== undefined,
    hasLocalData: hasLocalPeopleCache,
    hasError: !!peopleQuery.error,
    isOffline: !!peopleQuery.error && isNetworkFailure(peopleQuery.error),
  });
  const createOperation = useCallback(async (data: CreateAidRequest | CreatePersonRequest | ComplaintInput | TaskInput | FamilyHeadNeedInput, kind: 'aid' | 'person' | 'complaint-create' | 'task-create' | 'family-need') => {
    const id = requestId(); const idempotencyKey = requestId(); const epoch = identityEpoch.current;
    const item = { id, idempotencyKey, ownerUserId: user?.id || '', kind, data } as QueuedWrite;
    try {
      if (kind === 'aid') await createAid(data as CreateAidRequest, requestHeaders(idempotencyKey));
      if (kind === 'person') await createPerson(data as CreatePersonRequest, requestHeaders(idempotencyKey));
      if (kind === 'complaint-create') await createSyncComplaint(data as ComplaintInput, requestHeaders(idempotencyKey));
      if (kind === 'task-create') await createSyncTask(data as TaskInput, requestHeaders(idempotencyKey));
      if (kind === 'family-need') await createFamilyMeNeed(data as FamilyHeadNeedInput, requestHeaders(idempotencyKey));
      await invalidateFor(item); return { queued: false };
    } catch (error) { return queueOnNetworkError(error, item, epoch); }
  }, [invalidateFor, queueOnNetworkError, user]);
  const value = useMemo<AppValue>(() => ({
    signedIn: !!user, authLoading: !!token && !user, user, familyProfile: serverCache.familyProfile ?? null, familyNeeds: serverCache.familyNeeds ?? [], receivedAids: receivedAidsOwnerReady ? serverCache.receivedAids ?? [] : [], receivedAidsHasSnapshot: receivedAidsOwnerReady && serverCache.receivedAids !== undefined, receivedAidsLoading: receivedAidsOwnerReady && receivedAidsQuery.isPending && serverCache.receivedAids === undefined, receivedAidsError: receivedAidsOwnerReady && receivedAidsQuery.isError, lastReceivedAidsSyncAt, retryReceivedAids, signedInAsFamilyHead: authRole === 'displaced', aids: serverCache.aids.map(mapAid), people: serverCache.people.map(mapPerson), complaints: serverCache.complaints, tasks: serverCache.tasks, syncState, syncMessage, queuedCount: queue.length, aidsSyncState, aidsSyncMessage, lastAidsSyncAt, retryAids, pendingWrites: queue,
    peopleSyncState: peopleSync.state, peopleSyncMessage: peopleSync.message, lastPeopleSyncAt, retryPeople,
    canManageAids: !!user && (manager || delegate), canManagePeople: !!user && (manager || delegate), canManageComplaints: !!user && (manager || delegate), canManageTasks: !!user && (manager || security),
    signIn, signOut,
    addAid: (data) => createOperation(data, 'aid'), addPerson: (data) => createOperation(data, 'person'),
    addComplaint: (data) => createOperation(data, 'complaint-create'), addTask: (data) => createOperation(data, 'task-create'), addFamilyNeed: (data) => createOperation(data, 'family-need'),
    setComplaintStatus: async (id, status, expectedVersion) => {
      const writeId = requestId(); const epoch = identityEpoch.current;
      try { await updateComplaintStatus(id, { status, expectedVersion }, requestHeaders(writeId)); await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() }); return { queued: false }; }
      catch (error) { return queueOnNetworkError(error, { id: writeId, ownerUserId: user?.id || '', kind: 'complaint', targetId: id, status, expectedVersion }, epoch); }
    },
    setTaskStatus: async (id, status, expectedVersion) => {
      const writeId = requestId(); const epoch = identityEpoch.current;
      try { await updateTaskStatus(id, { status, expectedVersion }, requestHeaders(writeId)); await queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }); return { queued: false }; }
      catch (error) { return queueOnNetworkError(error, { id: writeId, ownerUserId: user?.id || '', kind: 'task', targetId: id, status, expectedVersion }, epoch); }
    },
    retrySync: async () => { await refetchAll(); await replayQueue(); },
    discardQueuedWrite: async (id) => saveQueue(queue.filter((item) => item.id !== id)),
    reviewTaskConflict,
  }), [aidsSyncMessage, aidsSyncState, authRole, createOperation, delegate, lastAidsSyncAt, lastPeopleSyncAt, lastReceivedAidsSyncAt, manager, peopleSync.message, peopleSync.state, queryClient, queue, queueOnNetworkError, receivedAidsOwnerReady, receivedAidsQuery.isError, receivedAidsQuery.isPending, refetchAll, replayQueue, retryAids, retryPeople, retryReceivedAids, reviewTaskConflict, saveQueue, security, serverCache, signIn, signOut, syncMessage, syncState, token, user]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}
