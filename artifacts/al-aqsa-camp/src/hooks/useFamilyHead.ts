import {
  ApiError,
  customFetch,
  type FamilyHeadNeed,
  type FamilyHeadNeedInput,
  type FamilyHeadNeedList,
  type FamilyHeadProfile,
  getGetFamilyMeNeedsQueryKey,
  getGetFamilyMeQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthToken, getAuthUser } from "@/utils/auth/getSession";

export type FamilyNeedDraft = FamilyHeadNeedInput;
type QueuedNeed = { id: string; key: string; ownerId: string; data: FamilyNeedDraft };

const draftKey = (ownerId: string) => `aqsa-family-need-draft:${ownerId}`;
const queueKey = (ownerId: string) => `aqsa-family-need-queue:${ownerId}`;
const requestId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isNetworkError = (error: unknown) => !(error instanceof ApiError);

export function useFamilyHead() {
  const token = getAuthToken();
  const queryClient = useQueryClient();
  const request = useMemo(() => ({
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  }), [token]);
  const profileQuery = useQuery({
    queryKey: getGetFamilyMeQueryKey(),
    queryFn: ({ signal }) => customFetch<FamilyHeadProfile>("/api/family/me", { ...request, signal }),
    enabled: Boolean(token),
    retry: false,
  });
  const needsQuery = useQuery({
    queryKey: getGetFamilyMeNeedsQueryKey(),
    queryFn: ({ signal }) => customFetch<FamilyHeadNeedList>("/api/family/me/needs", { ...request, signal }),
    enabled: Boolean(token),
    retry: false,
  });
  const [cachedProfile, setCachedProfile] = useState<FamilyHeadProfile | null>(null);
  const [cachedNeeds, setCachedNeeds] = useState<FamilyHeadNeedList>([]);
  const ownerId = profileQuery.data?.headUser.id ? String(profileQuery.data.headUser.id) : getAuthUser()?.id ? String(getAuthUser()!.id) : null;
  const [draft, setDraftState] = useState<FamilyNeedDraft>({
    category: "FOOD",
    title: "",
    description: "",
    priority: "MEDIUM",
  });
  const [queue, setQueue] = useState<QueuedNeed[]>([]);

  useEffect(() => {
    if (!ownerId) return;
    try {
      const storedProfile = localStorage.getItem(`${draftKey(ownerId)}:profile`);
      const storedNeeds = localStorage.getItem(`${draftKey(ownerId)}:needs`);
      const storedDraft = localStorage.getItem(draftKey(ownerId));
      const storedQueue = localStorage.getItem(queueKey(ownerId));
      if (storedProfile) setCachedProfile(JSON.parse(storedProfile) as FamilyHeadProfile);
      if (storedNeeds) setCachedNeeds(JSON.parse(storedNeeds) as FamilyHeadNeedList);
      if (storedDraft) setDraftState(JSON.parse(storedDraft) as FamilyNeedDraft);
      if (storedQueue) setQueue(JSON.parse(storedQueue) as QueuedNeed[]);
    } catch {
      setQueue([]);
    }
  }, [ownerId]);
  useEffect(() => {
    if (!ownerId || !profileQuery.data) return;
    localStorage.setItem(`${draftKey(ownerId)}:profile`, JSON.stringify(profileQuery.data));
  }, [ownerId, profileQuery.data]);
  useEffect(() => {
    if (!ownerId || !needsQuery.data) return;
    setCachedNeeds(needsQuery.data);
    localStorage.setItem(`${draftKey(ownerId)}:needs`, JSON.stringify(needsQuery.data));
  }, [needsQuery.data, ownerId]);

  const saveQueue = useCallback((next: QueuedNeed[]) => {
    setQueue(next);
    if (ownerId) localStorage.setItem(queueKey(ownerId), JSON.stringify(next));
  }, [ownerId]);
  const setDraft = useCallback((next: FamilyNeedDraft) => {
    setDraftState(next);
    if (ownerId) localStorage.setItem(draftKey(ownerId), JSON.stringify(next));
  }, [ownerId]);

  const syncQueue = useCallback(async () => {
    if (!ownerId || !queue.length) return;
    const remaining = [...queue];
    for (const item of queue) {
      try {
        await customFetch<FamilyHeadNeed>("/api/family/me/needs", {
          ...request,
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": item.key, ...request.headers },
          body: JSON.stringify(item.data),
        });
        remaining.shift();
        saveQueue([...remaining]);
      } catch (error) {
        if (isNetworkError(error)) break;
        remaining.shift();
        saveQueue([...remaining]);
      }
    }
    await queryClient.invalidateQueries({ queryKey: getGetFamilyMeNeedsQueryKey() });
  }, [ownerId, queue, queryClient, request, saveQueue]);

  useEffect(() => {
    void syncQueue();
    const onOnline = () => void syncQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncQueue]);

  const createNeed = useCallback(async (data: FamilyNeedDraft) => {
    const key = requestId();
    try {
      const created = await customFetch<FamilyHeadNeed>("/api/family/me/needs", {
        ...request,
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key, ...request.headers },
        body: JSON.stringify(data),
      });
      setDraft({ ...data, title: "", description: "" });
      await queryClient.invalidateQueries({ queryKey: getGetFamilyMeNeedsQueryKey() });
      return { queued: false, created };
    } catch (error) {
      if (!isNetworkError(error) || !ownerId) throw error;
      const item = { id: requestId(), key, ownerId, data };
      saveQueue([...queue, item]);
      setDraft({ ...data, title: "", description: "" });
      return { queued: true };
    }
  }, [ownerId, queryClient, queue, request, saveQueue, setDraft]);

  return {
    profile: profileQuery.data ?? cachedProfile,
    needs: needsQuery.data ?? cachedNeeds,
    draft,
    setDraft,
    createNeed,
    syncQueue,
    queuedNeeds: queue,
    isLoading: profileQuery.isLoading || needsQuery.isLoading,
    error: profileQuery.error ?? needsQuery.error,
  };
}