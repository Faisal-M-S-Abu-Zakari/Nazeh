'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveFamily,
  approveTask,
  createAidDistribution,
  createFamily,
  createNeed,
  getListCampsQueryKey,
  getListFamiliesQueryKey,
  getListNeedsQueryKey,
  getListSectorsQueryKey,
  getListSheltersQueryKey,
  getListTasksQueryKey,
  getListSecurityMembersQueryKey,
  getListAidDistributionsQueryKey,
  getListAidsQueryKey,
  receiveAidDistribution,
  submitTask,
  updateFamily,
  updateNeed,
  useListCamps,
  useListFamilies,
  useListAidDistributions,
  useListAids,
  useListNeeds,
  useListSecurityMembers,
  useListShelters,
  useListSectors,
  useListTasks,
} from '@workspace/api-client-react';
import type { Aid, AidDistribution, FamilyInput, FamilyMemberInput, FamilyUpdate, NeedInput, NeedStatus, TaskApproval, TaskSubmission } from '@workspace/api-client-react';
import { AlertCircle, CheckCircle2, ClipboardList, Home, Loader2, Search, ShieldCheck, Users } from 'lucide-react';
import useAuth from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type OfflineFamilyDraft = FamilyInput & { idempotencyKey: string };
type OfflineTaskDraft = TaskSubmission & { taskId: string; idempotencyKey: string };

const labels: Record<string, string> = {
  PENDING_APPROVAL: 'بانتظار الاعتماد',
  ACTIVE: 'نشطة',
  ARCHIVED: 'مؤرشفة',
  REQUIRED: 'مطلوب',
  APPROVED: 'معتمد',
  IN_PROGRESS: 'قيد المعالجة',
  FULFILLED: 'منفّذ',
  CANCELLED: 'ملغى',
  ASSIGNED: 'مسند للتسليم',
  RECEIVED: 'تم الاستلام',
  CRITICAL: 'حرج',
  HIGH: 'عالي',
  MEDIUM: 'متوسط',
  LOW: 'منخفض',
};

const statusVariant = (value: string) =>
  value === 'ACTIVE' || value === 'FULFILLED' ? 'default' :
    value === 'PENDING_APPROVAL' || value === 'REQUIRED' ? 'secondary' : 'outline';

function ErrorState({ message = 'تعذر تحميل البيانات. حاول مرة أخرى.' }: { message?: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="size-4" />{message}</div>;
}

function LoadingState() {
  return <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" />جارٍ تحميل سجل التشغيل...</div>;
}

export default function OperationsDashboard() {
  const { isLoading: authLoading, isAuthenticated, isManager, isDelegate, isSecurityOfficer, user } = useAuth();
  const role = isSecurityOfficer ? 'SECURITY_OFFICER' : isDelegate ? 'DELEGATE' : isManager ? 'MANAGER' : 'SECURITY_MEMBER';
  const canManageFamilies = isManager || isDelegate;
  const canReview = isManager;
  const isSecurity = isSecurityOfficer || role === 'SECURITY_MEMBER';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [distributionAidId, setDistributionAidId] = useState('');
  const [distributionFamilyId, setDistributionFamilyId] = useState('');
  const [distributionNeedId, setDistributionNeedId] = useState('');
  const [distributionQuantity, setDistributionQuantity] = useState('1');
  const [headName, setHeadName] = useState('');
  const [needTitle, setNeedTitle] = useState('');
  const [members, setMembers] = useState<FamilyMemberInput[]>([]);
  const [memberName, setMemberName] = useState('');
  const [memberCritical, setMemberCritical] = useState(false);
  const [notice, setNotice] = useState('');
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineFamilyDraft[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return (JSON.parse(window.localStorage.getItem('aqsa-family-drafts') ?? '[]') as FamilyInput[]).map((draft) => ({
        ...draft,
        idempotencyKey: (draft as OfflineFamilyDraft).idempotencyKey ?? crypto.randomUUID(),
      }));
    } catch { return []; }
  });
  const [offlineTaskDrafts, setOfflineTaskDrafts] = useState<OfflineTaskDraft[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(window.localStorage.getItem('aqsa-task-drafts') ?? '[]') as OfflineTaskDraft[]; } catch { return []; }
  });

  const camps = useListCamps({ query: { queryKey: getListCampsQueryKey(), enabled: canManageFamilies || isSecurityOfficer } });
  const sectors = useListSectors({ query: { queryKey: getListSectorsQueryKey(), enabled: canManageFamilies || isSecurityOfficer } });
  const shelters = useListShelters({ query: { queryKey: getListSheltersQueryKey(), enabled: canManageFamilies || isSecurityOfficer } });
  const families = useListFamilies({ query: { queryKey: getListFamiliesQueryKey(), enabled: canManageFamilies } });
  const needs = useListNeeds({ query: { queryKey: getListNeedsQueryKey(), enabled: canManageFamilies || isSecurityOfficer } });
  const aids = useListAids({ query: { queryKey: getListAidsQueryKey(), enabled: canManageFamilies } });
  const distributions = useListAidDistributions(distributionAidId, {
    query: {
      queryKey: getListAidDistributionsQueryKey(distributionAidId),
      enabled: canManageFamilies && Boolean(distributionAidId),
    },
  });
  const tasks = useListTasks({ query: { queryKey: getListTasksQueryKey(), enabled: isSecurity } });
  const securityMembers = useListSecurityMembers({ query: { queryKey: getListSecurityMembersQueryKey(), enabled: isSecurityOfficer } });

  const createFamilyMutation = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: FamilyInput; idempotencyKey: string }) =>
      createFamily(data, { headers: { 'Idempotency-Key': idempotencyKey } }),
    onSuccess: () => {
      setHeadName('');
      setMembers([]);
      setMemberName('');
      setMemberCritical(false);
      setNotice('تم حفظ الأسرة كمسودة بانتظار اعتماد المدير.');
      queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() });
    },
  });
  const createNeedMutation = useMutation({
    mutationFn: (data: NeedInput) => createNeed(data, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => {
      setNeedTitle('');
      setNotice('تم إنشاء طلب الاحتياج.');
      queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() });
    },
  });
  const approveMutation = useMutation({
    mutationFn: (familyId: string) => approveFamily(familyId, {}, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => {
      setNotice('تم اعتماد الأسرة وتفعيلها.');
      queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() });
    },
  });
  const updateFamilyMutation = useMutation({
    mutationFn: ({ familyId, data }: { familyId: string; data: FamilyUpdate }) =>
      updateFamily(familyId, data, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => {
      setNotice('تم تحديث وحدة إيواء الأسرة وحفظ سجل النقل.');
      queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() });
    },
  });
  const changeNeedMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: NeedStatus; expectedVersion: number } }) =>
      updateNeed(id, data, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() }),
  });
  const assignDistributionMutation = useMutation({
    mutationFn: () => createAidDistribution(
      distributionAidId,
      {
        familyId: distributionFamilyId,
        needId: distributionNeedId,
        quantity: Number(distributionQuantity),
      },
      { headers: { 'Idempotency-Key': crypto.randomUUID() } },
    ),
    onSuccess: () => {
      setNotice('تم ربط المساعدة بالأسرة وتسجيل عملية التوزيع.');
      queryClient.invalidateQueries({ queryKey: getListAidDistributionsQueryKey(distributionAidId) });
      queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() });
      setDistributionNeedId('');
    },
  });
  const receiveDistributionMutation = useMutation({
    mutationFn: ({ aidId, distributionId }: { aidId: string; distributionId: string }) =>
      receiveAidDistribution(distributionId, {}, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: (receivedDistribution, { aidId }) => {
      setNotice('تم تسجيل الاستلام مع الوقت والمنفذ.');
      const wasAlreadyReceived = queryClient
        .getQueryData<AidDistribution[]>(getListAidDistributionsQueryKey(aidId))
        ?.some(
          (distribution) =>
            distribution.id === receivedDistribution.id && distribution.status === 'RECEIVED',
        );
      queryClient.setQueryData<AidDistribution[]>(
        getListAidDistributionsQueryKey(aidId),
        (currentDistributions) =>
          currentDistributions?.map((distribution) =>
            distribution.id === receivedDistribution.id ? receivedDistribution : distribution,
          ) ?? [receivedDistribution],
      );
      if (!wasAlreadyReceived && receivedDistribution.status === 'RECEIVED') {
        queryClient.setQueriesData<Aid[]>(
          { queryKey: getListAidsQueryKey() },
          (currentAids) =>
            currentAids?.map((aid) =>
              aid.id === aidId
                ? {
                    ...aid,
                    receivedDistributionCount: (aid.receivedDistributionCount ?? 0) + 1,
                  }
                : aid,
            ),
        );
      }
      queryClient.invalidateQueries({ queryKey: getListAidDistributionsQueryKey(aidId) });
      queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() });
    },
  });
  const submitTaskMutation = useMutation({
    mutationFn: ({ id, data, idempotencyKey }: { id: string; data: TaskSubmission; idempotencyKey: string }) =>
      submitTask(id, data, { headers: { 'Idempotency-Key': idempotencyKey } }),
    onSuccess: () => {
      setNotice('تم رفع نتيجة المهمة بانتظار اعتماد مسؤول الأمن.');
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    },
  });
  const familyPayload = (draft: OfflineFamilyDraft): FamilyInput => {
    const { idempotencyKey: _idempotencyKey, ...data } = draft;
    return data;
  };
  const approveTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskApproval }) =>
      approveTask(id, data, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: () => {
      setNotice('تم اعتماد إكمال المهمة.');
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    },
  });
  useEffect(() => {
    const syncDrafts = () => {
      if (!navigator.onLine || offlineDrafts.length === 0) return;
      for (const draft of offlineDrafts) {
        createFamilyMutation.mutate({ data: familyPayload(draft), idempotencyKey: draft.idempotencyKey }, {
          onSuccess: () => setOfflineDrafts((current) => {
            const remaining = current.filter((item) => item.idempotencyKey !== draft.idempotencyKey);
            window.localStorage.setItem('aqsa-family-drafts', JSON.stringify(remaining));
            return remaining;
          }),
        });
      }
    };
    window.addEventListener('online', syncDrafts);
    syncDrafts();
    return () => window.removeEventListener('online', syncDrafts);
  }, [offlineDrafts]);
  useEffect(() => {
    const syncTaskDrafts = () => {
      if (!navigator.onLine || offlineTaskDrafts.length === 0) return;
      for (const draft of offlineTaskDrafts) {
        submitTaskMutation.mutate({ id: draft.taskId, data: { result: draft.result, expectedVersion: draft.expectedVersion }, idempotencyKey: draft.idempotencyKey }, {
          onSuccess: () => setOfflineTaskDrafts((current) => {
            const remaining = current.filter((item) => item.idempotencyKey !== draft.idempotencyKey);
            window.localStorage.setItem('aqsa-task-drafts', JSON.stringify(remaining));
            return remaining;
          }),
        });
      }
    };
    window.addEventListener('online', syncTaskDrafts);
    syncTaskDrafts();
    return () => window.removeEventListener('online', syncTaskDrafts);
  }, [offlineTaskDrafts]);

  const filteredFamilies = useMemo(() => (families.data ?? []).filter((family) =>
    `${family.headName} ${family.id}`.toLowerCase().includes(search.toLowerCase())), [families.data, search]);
  const sectorName = (id: string) => sectors.data?.find((item) => item.id === id)?.name ?? 'غير محدد';
  const shelterName = (id?: string | null) => {
    if (!id) return 'بدون مأوى';
    const shelter = shelters.data?.find((item) => item.id === id);
    if (shelter) return shelter.code;
    if (shelters.isLoading) return 'جارٍ تحميل بيانات المأوى';
    if (shelters.isError) return 'تعذر تحميل بيانات المأوى';
    return 'مأوى مؤرشف';
  };
  const selectedAid = aids.data?.find((aid) => aid.id === distributionAidId);
  const submitTaskNow = (task: { id: string; version: number }) => {
    const data = { result: 'تم التنفيذ ميدانياً', expectedVersion: task.version };
    if (!navigator.onLine) {
      const next = [...offlineTaskDrafts.filter((item) => item.taskId !== task.id), { taskId: task.id, ...data, idempotencyKey: crypto.randomUUID() }];
      setOfflineTaskDrafts(next);
      window.localStorage.setItem('aqsa-task-drafts', JSON.stringify(next));
      setNotice('لا يوجد اتصال. حُفظت نتيجة المهمة محلياً وستتم مزامنتها عند عودة الشبكة.');
      return;
    }
    submitTaskMutation.mutate({ id: task.id, data, idempotencyKey: crypto.randomUUID() });
  };

  if (authLoading) return <LoadingState />;
  if (!isAuthenticated) return <ErrorState message="يجب تسجيل الدخول للوصول إلى سجل التشغيل." />;

  const createFamilyNow = () => {
    const camp = camps.data?.[0];
    const sector = sectors.data?.find((item) => item.campId === camp?.id);
    if (!camp || !sector || !headName.trim()) return;
    const draft: OfflineFamilyDraft = {
      campId: camp.id,
      sectorId: sector.id,
      shelterId: shelters.data?.find((item) => item.sectorId === sector.id)?.id ?? null,
      headName: headName.trim(),
      members: [
        { fullName: headName.trim(), gender: 'OTHER', relationship: 'رب الأسرة', criticalCase: false },
        ...members,
      ],
      idempotencyKey: crypto.randomUUID(),
    };
    if (!navigator.onLine) {
      const next = [...offlineDrafts, draft];
      setOfflineDrafts(next);
      window.localStorage.setItem('aqsa-family-drafts', JSON.stringify(next));
      setNotice('لا يوجد اتصال. حُفظت المسودة محلياً وستتم مزامنتها تلقائياً عند عودة الشبكة.');
      setHeadName('');
      return;
    }
    createFamilyMutation.mutate({ data: familyPayload(draft), idempotencyKey: draft.idempotencyKey });
  };

  return (
    <main dir="rtl" className="min-h-screen w-full bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-primary/20 border-r-4 border-r-primary bg-white p-6 text-slate-900 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-primary">مركز العمليات الإنسانية</p>
              <h1 className="text-2xl font-bold sm:text-3xl">سجل الأسر والإيواء والاحتياجات</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">دورة موحّدة تبدأ من الأسرة وتنتهي بتنفيذ الاحتياج، مع صلاحيات واضحة وسجل تغييرات قابل للتدقيق.</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <span className="text-slate-600">الحساب الحالي</span>
              <div className="mt-1 font-semibold">{user?.name ?? 'مستخدم مصرح'}</div>
              <div className="text-primary">{role === 'SECURITY_MEMBER' ? 'فرد أمن' : role === 'SECURITY_OFFICER' ? 'مسؤول أمن' : role === 'DELEGATE' ? 'مندوب' : 'مدير'}</div>
            </div>
          </div>
        </header>

        {notice && <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{notice}</div>}
        {(families.isError || needs.isError || camps.isError) && <ErrorState />}

        {canManageFamilies && (
          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" />تسجيل أسرة جديدة</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">تُسجل الأسرة مبدئياً بواسطة المندوب، ولا تظهر كفعالة حتى اعتماد المدير.</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input value={headName} onChange={(event) => setHeadName(event.target.value)} placeholder="اسم رب الأسرة" aria-label="اسم رب الأسرة" />
                  <Button onClick={createFamilyNow} disabled={!headName.trim() || createFamilyMutation.isPending}>{createFamilyMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ بانتظار الاعتماد'}</Button>
                </div>
                <div className="rounded-lg border border-dashed p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-600">أفراد إضافيون وحالات حرجة</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="اسم العضو" aria-label="اسم عضو الأسرة" />
                    <label className="flex items-center gap-2 whitespace-nowrap text-xs">
                      <input type="checkbox" checked={memberCritical} onChange={(event) => setMemberCritical(event.target.checked)} />
                      حالة حرجة
                    </label>
                    <Button variant="outline" size="sm" disabled={!memberName.trim()} onClick={() => {
                      setMembers((current) => [...current, { fullName: memberName.trim(), gender: 'OTHER', relationship: 'عضو الأسرة', criticalCase: memberCritical }]);
                      setMemberName('');
                      setMemberCritical(false);
                    }}>إضافة عضو</Button>
                  </div>
                  {members.length > 0 && <ul className="mt-2 space-y-1 text-xs text-slate-600">{members.map((member, index) => <li key={`${member.fullName}-${index}`} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1"><span>{member.fullName}{member.criticalCase ? ' · حالة حرجة' : ''}</span><button type="button" className="text-red-600" onClick={() => setMembers((current) => current.filter((_, itemIndex) => itemIndex !== index))}>حذف</button></li>)}</ul>}
                </div>
                {offlineDrafts.length > 0 && <p className="text-xs text-amber-700">مسودات محلية بانتظار المزامنة: {offlineDrafts.length}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-primary" />طلب احتياج</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <select value={selectedFamily} onChange={(event) => setSelectedFamily(event.target.value)} className="h-10 w-full rounded-md border bg-transparent px-3 text-sm" aria-label="اختر الأسرة">
                  <option value="">اختر الأسرة</option>
                  {(families.data ?? []).map((family) => <option key={family.id} value={family.id}>{family.headName}</option>)}
                </select>
                <div className="flex gap-2">
                  <Input value={needTitle} onChange={(event) => setNeedTitle(event.target.value)} placeholder="وصف الاحتياج" aria-label="وصف الاحتياج" />
                  <Button disabled={!selectedFamily || !needTitle.trim() || createNeedMutation.isPending} onClick={() => createNeedMutation.mutate({ familyId: selectedFamily, category: 'OTHER', title: needTitle.trim(), priority: 'HIGH' })}>إرسال</Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {canManageFamilies && (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><Home className="size-5 text-primary" />الأسر والإيواء</CardTitle>
              <div className="relative w-full max-w-xs"><Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" /><Input className="pr-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالاسم أو المعرّف" /></div>
            </CardHeader>
            <CardContent>
              {families.isLoading ? <LoadingState /> : filteredFamilies.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">لا توجد أسر مطابقة للبحث.</p> :
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredFamilies.map((family) => (
                  <div key={family.id} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{family.headName}</h3><p className="mt-1 text-xs text-muted-foreground">#{family.id.slice(0, 8)}</p></div><Badge variant={statusVariant(family.status) as 'default' | 'secondary' | 'outline'}>{labels[family.status]}</Badge></div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600"><p>القطاع: {sectorName(family.sectorId)}</p><p data-testid={`text-family-shelter-${family.id}`}>الإيواء: {shelterName(family.shelterId)}</p><p>الإصدار: {family.version}</p></div>
                    {canReview && <div className="mt-4 space-y-2">
                      {family.status === 'PENDING_APPROVAL' && <Button className="w-full" size="sm" onClick={() => approveMutation.mutate(family.id)} disabled={approveMutation.isPending}><CheckCircle2 className="size-4" />اعتماد وتفعيل</Button>}
                      <select className="h-9 w-full rounded-md border bg-transparent px-2 text-xs" value={family.shelterId ?? ''} disabled={updateFamilyMutation.isPending} onChange={(event) => updateFamilyMutation.mutate({ familyId: family.id, data: { shelterId: event.target.value || null, expectedVersion: family.version } })} aria-label={`تعديل إيواء ${family.headName}`}>
                        <option value="">بدون وحدة إيواء</option>
                        {(shelters.data ?? []).filter((shelter) => shelter.sectorId === family.sectorId).map((shelter) => <option key={shelter.id} value={shelter.id}>{shelter.code} · {shelter.status === 'MAINTENANCE' ? 'صيانة' : 'متاح'}</option>)}
                      </select>
                    </div>}
                  </div>
                ))}</div>}
            </CardContent>
          </Card>
        )}

        {(canManageFamilies || isSecurityOfficer) && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-primary" />طلبات الاحتياج</CardTitle></CardHeader>
            <CardContent>
              {needs.isLoading ? <LoadingState /> : (needs.data ?? []).length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">لا توجد طلبات احتياج.</p> :
                <div className="space-y-3">{(needs.data ?? []).map((need) => <div key={need.id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{need.title}</p><p className="mt-1 text-sm text-muted-foreground">الأولوية: {labels[need.priority]} · الأسرة: #{need.familyId.slice(0, 8)}</p></div><div className="flex items-center gap-2"><Badge variant={statusVariant(need.status) as 'default' | 'secondary' | 'outline'}>{labels[need.status]}</Badge>{need.status !== 'FULFILLED' && <select className="h-8 rounded-md border bg-transparent px-2 text-xs" value={need.status} onChange={(event) => changeNeedMutation.mutate({ id: need.id, data: { status: event.target.value as NeedStatus, expectedVersion: need.version } })}><option value="REQUIRED">مطلوب</option><option value="APPROVED">اعتماد للتوزيع</option><option value="IN_PROGRESS">قيد المعالجة</option><option value="FULFILLED">منفّذ</option></select>}</div></div>)}</div>}
            </CardContent>
          </Card>
        )}

        {canManageFamilies && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-primary" />توزيع المساعدة وتتبع الاستلام</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">لا يمكن توزيع المساعدة إلا على أسرة نشطة وطلب احتياج معتمد، ويُمنع تكرار الأسرة في دورة المساعدة نفسها.</p>
              <div className="grid gap-3 md:grid-cols-4">
                <select value={distributionAidId} onChange={(event) => { setDistributionAidId(event.target.value); setDistributionNeedId(''); }} className="h-10 rounded-md border bg-transparent px-3 text-sm" aria-label="اختر المساعدة">
                  <option value="">اختر المساعدة</option>
                  {(aids.data ?? []).map((aid) => <option key={aid.id} value={aid.id}>{aid.title} · {aid.quantity} {aid.unit}</option>)}
                </select>
                <select value={distributionFamilyId} onChange={(event) => { setDistributionFamilyId(event.target.value); setDistributionNeedId(''); }} className="h-10 rounded-md border bg-transparent px-3 text-sm" aria-label="اختر الأسرة المستلمة">
                  <option value="">اختر الأسرة</option>
                  {(families.data ?? []).filter((family) => family.status === 'ACTIVE').map((family) => <option key={family.id} value={family.id}>{family.headName}</option>)}
                </select>
                <select value={distributionNeedId} onChange={(event) => setDistributionNeedId(event.target.value)} className="h-10 rounded-md border bg-transparent px-3 text-sm" aria-label="اختر طلب الاحتياج المعتمد">
                  <option value="">اختر الطلب المعتمد</option>
                  {(needs.data ?? []).filter((need) => need.familyId === distributionFamilyId && need.status === 'APPROVED').map((need) => <option key={need.id} value={need.id}>{need.title}</option>)}
                </select>
                <div className="flex gap-2">
                  <Input type="number" min="1" value={distributionQuantity} onChange={(event) => setDistributionQuantity(event.target.value)} aria-label="كمية التوزيع" />
                  <Button disabled={!distributionAidId || !distributionFamilyId || !distributionNeedId || Number(distributionQuantity) < 1 || assignDistributionMutation.isPending} onClick={() => assignDistributionMutation.mutate()}>تسجيل</Button>
                </div>
              </div>
              {distributionAidId && (
                <div className="space-y-2 rounded-xl border bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">سجل هذه المساعدة</p><div className="flex gap-3 text-xs text-muted-foreground"><span>{distributions.data?.length ?? 0} أسرة مرتبطة</span><span data-testid="received-distribution-count">عدد المستلمين: {selectedAid?.receivedDistributionCount ?? 0}</span></div></div>
                  {(distributions.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">لم تُسجل توزيعات بعد.</p> :
                    (distributions.data ?? []).map((distribution) => <div key={distribution.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-sm"><span>الأسرة #{distribution.familyId.slice(0, 8)} · {distribution.quantity} {distribution.unit}</span><div className="flex items-center gap-2"><Badge variant={distribution.status === 'RECEIVED' ? 'default' : 'secondary'}>{labels[distribution.status]}</Badge>{distribution.status === 'ASSIGNED' && <Button size="sm" variant="outline" disabled={receiveDistributionMutation.isPending} onClick={() => receiveDistributionMutation.mutate({ aidId: distributionAidId, distributionId: distribution.id })}>تسجيل الاستلام</Button>}</div></div>)}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isSecurity && (
          <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />مهام الأمن</CardTitle></CardHeader>
              <CardContent>
                {tasks.isLoading ? <LoadingState /> : (tasks.data ?? []).length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">لا توجد مهام مسندة.</p> :
                  <div className="space-y-3">{(tasks.data ?? []).map((task) => <div key={task.id} className="rounded-xl border bg-white p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{task.title}</p><p className="mt-1 text-sm text-muted-foreground">{task.location ?? 'الموقع غير محدد'}</p></div><Badge variant="outline">{labels[task.status] ?? task.status}</Badge></div>{role === 'SECURITY_MEMBER' && task.status !== 'COMPLETED' && <Button size="sm" className="mt-3" onClick={() => submitTaskNow(task)}>رفع النتيجة</Button>}{isSecurityOfficer && task.status === 'COMPLETED' && !task.approvedAt && <Button size="sm" className="mt-3" onClick={() => approveTaskMutation.mutate({ id: task.id, data: { expectedVersion: task.version } })}><CheckCircle2 className="size-4" />اعتماد الإكمال</Button>}</div>)}</div>}
                {offlineTaskDrafts.length > 0 && <p className="mt-3 text-xs text-amber-700">نتائج محلية بانتظار المزامنة: {offlineTaskDrafts.length}</p>}
              </CardContent>
            </Card>
            {isSecurityOfficer && <Card><CardHeader><CardTitle>أفراد الأمن</CardTitle></CardHeader><CardContent>{securityMembers.isLoading ? <LoadingState /> : <div className="space-y-2">{(securityMembers.data ?? []).map((member) => <div key={member.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{member.name}</span><Badge variant="outline">{member.role === 'SECURITY_OFFICER' ? 'مسؤول' : 'فرد'}</Badge></div>)}</div>}</CardContent></Card>}
          </section>
        )}
      </div>
    </main>
  );
}