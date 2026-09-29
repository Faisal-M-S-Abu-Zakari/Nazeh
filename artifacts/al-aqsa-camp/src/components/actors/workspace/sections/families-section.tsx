import React, { useRef, useState } from 'react';
import { useListFamilies, useGetFamily, getListFamiliesQueryKey, getListCampsQueryKey, getListSectorsQueryKey, useListCamps, useListSectors, useListShelters, useListDelegates, useCreateFamily, useCreateCamp, useCreateSector, useImportFamilies, useListNeeds, useListAidDistributions } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Alert, Button, Card, Table, Text, Badge, ActionIcon, Group, TextInput, Select, Title, Tabs, FileInput, Checkbox } from '@mantine/core';
import { Search, Plus, ArrowRight, Eye, User, Home, Users, ClipboardList, Package, AlertCircle } from 'lucide-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import { cn } from '@/utils/cn';
import useAuth from '@/hooks/useAuth';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useQueryClient } from '@tanstack/react-query';
import { createFamilyWorkbook, MAX_WORKBOOK_BYTES, parseFamilyWorkbook, type FamilyImportPreview } from './family-import';
import { getLocationIdempotencyAttempt, type LocationIdempotencyAttempt } from './family-location-setup';
import type { CampList, SectorList, ShelterList } from '@workspace/api-client-react';

dayjs.locale('ar');

const statusColors: Record<string, string> = {
  PENDING_APPROVAL: 'orange',
  ACTIVE: 'teal',
  ARCHIVED: 'gray'
};

const statusLabels: Record<string, string> = {
  PENDING_APPROVAL: 'قيد المراجعة',
  ACTIVE: 'نشط',
  ARCHIVED: 'مؤرشف'
};

export default function FamiliesSection({ params }: { params?: Record<string, string | undefined> }) {
  const isNew = !params?.id || params?.id === 'new';
  
  if (params?.id === 'new') {
    return <FamilyForm />;
  }

  if (params?.id) {
    return <FamilyDetail id={params.id} />;
  }

  return <FamilyList />;
}

function FamilyList() {
  const [search, setSearch] = React.useState('');
  const [location, setLocation] = useLocation();
  const { isManager } = useAuth();
  const { data: camps } = useListCamps();
  const { data: sectors } = useListSectors();
  const { data: shelters } = useListShelters();
  const { data: families, isLoading, error } = useListFamilies({ 
    query: { queryKey: getListFamiliesQueryKey() } 
  });

  if (isLoading) return <LoadingState message="جاري تحميل قائمة الأسر..." />;
  if (error) return <ErrorState message="حدث خطأ أثناء تحميل البيانات." />;

  const filtered = (families || []).filter(f => 
    f.headName.includes(search) || 
    f.id.includes(search) || 
    (f.headPhone && f.headPhone.includes(search))
  );

  return (
    <div className="space-y-6">
      {isManager && (
        <FamilyImportPanel
          camps={camps || []}
          sectors={sectors || []}
          shelters={shelters || []}
        />
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="text-3xl font-display text-primary">إدارة الأسر والنازحين</Title>
          <Text className="text-muted-foreground mt-1">عرض وتحديث بيانات العائلات ووحدات الإيواء المرتبطة</Text>
        </div>
        <Link href="/families/new" className="no-underline">
          <Button leftSection={<Plus size={18} />} size="md" radius="md" className="bg-primary hover:bg-primary/90">
            إضافة أسرة جديدة
          </Button>
        </Link>
      </div>

      <Card withBorder shadow="sm" radius="lg" className="overflow-hidden bg-white dark:bg-card">
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex gap-4 max-w-md">
            <TextInput
              placeholder="ابحث باسم رب الأسرة، رقم الهاتف، أو المعرف..."
              leftSection={<Search size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              className="flex-1"
              radius="md"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>رب الأسرة</Table.Th>
                <Table.Th>المخيم / القطاع</Table.Th>
                <Table.Th>الحالة</Table.Th>
                <Table.Th>تاريخ التسجيل</Table.Th>
                <Table.Th className="text-left">الإجراءات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length > 0 ? (
                filtered.map((family) => (
                  <Table.Tr key={family.id} className="group">
                    <Table.Td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User size={20} />
                        </div>
                        <div>
                          <Text fw={600} size="sm">{family.headName}</Text>
                          {family.headPhone && (
                            <Text size="xs" c="dimmed" dir="ltr" className="text-right">{family.headPhone}</Text>
                          )}
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div className="flex flex-col">
                        <Text size="sm" fw={500}>{family.campId}</Text>
                        <Text size="xs" c="dimmed">{family.sectorId}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[family.status] || 'gray'} variant="light" size="md" radius="sm">
                        {statusLabels[family.status] || family.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{dayjs(family.createdAt).format('DD MMMM YYYY')}</Text>
                    </Table.Td>
                    <Table.Td className="text-left">
                      <ActionIcon 
                        variant="light" 
                        color="teal" 
                        size="lg" 
                        radius="md"
                        onClick={() => setLocation(`/families/${family.id}`)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye size={18} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5} className="text-center py-10">
                    <Text c="dimmed">لا توجد عائلات تطابق بحثك.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function FamilyImportPanel({
  camps,
  sectors,
  shelters,
}: {
  camps: CampList;
  sectors: SectorList;
  shelters: ShelterList;
}) {
  const queryClient = useQueryClient();
  const [campId, setCampId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FamilyImportPreview | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [campName, setCampName] = useState('');
  const [sectorName, setSectorName] = useState('');
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const campHeaders = useRef<Record<string, string>>({});
  const sectorHeaders = useRef<Record<string, string>>({});
  const campAttempt = useRef<LocationIdempotencyAttempt | null>(null);
  const sectorAttempt = useRef<LocationIdempotencyAttempt | null>(null);
  const selectedCamp = camps.find((camp) => camp.id === campId);
  const campSectors = sectors.filter((sector) => sector.campId === campId);
  const hasCampSector = campSectors.length > 0;
  const createCamp = useCreateCamp({ request: { headers: campHeaders.current } });
  const createSector = useCreateSector({ request: { headers: sectorHeaders.current } });
  const importMutation = useImportFamilies({
    request: { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} },
  });

  const selectCamp = (value: string | null) => {
    setCampId(value);
    sectorAttempt.current = null;
    delete sectorHeaders.current['Idempotency-Key'];
    setFile(null);
    setPreview(null);
    setIdempotencyKey(null);
    setReviewConfirmed(false);
    setFileError(null);
    setSuccessCount(null);
    setSetupMessage(null);
    setSetupError(null);
  };

  const idempotencyKeyFor = (
    input: string,
    attempt: { current: LocationIdempotencyAttempt | null },
    headers: { current: Record<string, string> },
  ): string | null => {
    if (attempt.current?.input === input) {
      headers.current['Idempotency-Key'] = attempt.current.key;
      return attempt.current.key;
    }
    if (!globalThis.crypto?.randomUUID) {
      setSetupError('تعذر إنشاء مفتاح آمن لإتمام الطلب. حدّث المتصفح ثم أعد المحاولة.');
      return null;
    }
    const nextAttempt = getLocationIdempotencyAttempt(input, attempt.current, () => globalThis.crypto.randomUUID());
    attempt.current = nextAttempt;
    headers.current['Idempotency-Key'] = nextAttempt.key;
    return nextAttempt.key;
  };

  const clearCampAttempt = () => {
    campAttempt.current = null;
    delete campHeaders.current['Idempotency-Key'];
  };

  const clearSectorAttempt = () => {
    sectorAttempt.current = null;
    delete sectorHeaders.current['Idempotency-Key'];
  };

  const refreshLocationOptions = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: getListCampsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListSectorsQueryKey() }),
    ]);
  };

  const errorMessage = (error: unknown, fallback: string): string => {
    if (typeof error === 'object' && error !== null && 'data' in error) {
      const data = (error as { data?: unknown }).data;
      if (typeof data === 'object' && data !== null && 'error' in data) {
        return String((data as { error: unknown }).error);
      }
    }
    return fallback;
  };

  const errorStatus = (error: unknown): number | undefined => {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = Number((error as { status: unknown }).status);
      return Number.isFinite(status) ? status : undefined;
    }
    return undefined;
  };

  const submitCamp = () => {
    const name = campName.trim();
    const key = idempotencyKeyFor(name, campAttempt, campHeaders);
    if (!key) return;
    setSetupError(null);
    setSetupMessage(null);
    createCamp.mutate({ data: { name } }, {
      onSuccess: (camp) => {
        clearCampAttempt();
        setCampName('');
        selectCamp(camp.id);
        setSetupMessage(`تم إنشاء المخيم «${camp.name}» واختياره.`);
        refreshLocationOptions();
      },
      onError: (error) => {
        setSetupError(errorMessage(error, 'تعذر إنشاء المخيم.'));
        if (errorStatus(error) === 409) clearCampAttempt();
        refreshLocationOptions();
      },
    });
  };

  const submitSector = () => {
    if (!campId) return;
    const name = sectorName.trim();
    const key = idempotencyKeyFor(JSON.stringify([campId, name]), sectorAttempt, sectorHeaders);
    if (!key) return;
    setSetupError(null);
    setSetupMessage(null);
    createSector.mutate({ data: { campId, name } }, {
      onSuccess: (sector) => {
        clearSectorAttempt();
        setSectorName('');
        setSetupMessage(`تمت إضافة القطاع «${sector.name}».`);
        refreshLocationOptions();
      },
      onError: (error) => {
        setSetupError(errorMessage(error, 'تعذر إضافة القطاع.'));
        if (errorStatus(error) === 409) clearSectorAttempt();
        refreshLocationOptions();
      },
    });
  };

  const downloadTemplate = async () => {
    if (!selectedCamp || !hasCampSector) return;
    const workbook = createFamilyWorkbook(selectedCamp.name, campSectors, shelters);
    const bytes = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'قالب-استيراد-الأسر.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectWorkbook = async (selectedFile: File | null) => {
    setFile(selectedFile);
    setPreview(null);
    setIdempotencyKey(null);
    setReviewConfirmed(false);
    setSuccessCount(null);
    setFileError(null);
    if (!selectedFile) return;
    if (!campId) {
      setFileError('اختر المخيم قبل تحميل الملف حتى تُطابق أسماء القطاعات.');
      return;
    }
    if (!hasCampSector) {
      setFileError('أضف قطاعاً واحداً على الأقل إلى المخيم قبل تحميل الملف أو تنزيل القالب.');
      return;
    }
    if (!selectedFile.name.toLocaleLowerCase().endsWith('.xlsx')) {
      setFileError('الملف المدعوم هو Excel بصيغة .xlsx فقط.');
      return;
    }
    if (selectedFile.size > MAX_WORKBOOK_BYTES) {
      setFileError('حجم الملف يتجاوز الحد المسموح (5 ميغابايت).');
      return;
    }
    try {
      if (!globalThis.crypto?.subtle) throw new Error('تعذر إنشاء بصمة آمنة لهذا الملف في المتصفح.');
      const buffer = await selectedFile.arrayBuffer();
      const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
      const key = `sha256-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
      const result = await parseFamilyWorkbook(buffer, campId, sectors, shelters);
      setPreview(result);
      setIdempotencyKey(key);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'تعذر تحليل الملف محلياً.');
    }
  };

  const submitImport = () => {
    if (!hasCampSector || !preview || preview.errors.length || !reviewConfirmed || !idempotencyKey) return;
    setFileError(null);
    if (!campId) return;
    importMutation.mutate({ data: { campId, families: preview.families } }, {
      onSuccess: (result) => {
        setSuccessCount(result.importedCount);
        setFile(null);
        setPreview(null);
        setReviewConfirmed(false);
        queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() });
      },
      onError: (error) => {
        const apiMessage = 'data' in error && typeof error.data === 'object' && error.data !== null && 'error' in error.data
          ? String(error.data.error)
          : '';
        setFileError(apiMessage || 'تعذر استيراد الملف. لم تُحفظ أي أسرة؛ أعد المحاولة أو راجع البيانات.');
      },
    });
  };

  return (
    <div className="space-y-4">
      <Card withBorder shadow="sm" radius="lg" className="space-y-4">
        <div>
          <Title order={3} className="text-xl font-display text-primary">إعداد المخيم والقطاعات</Title>
          <Text size="sm" c="dimmed" mt={4}>اختر مخيماً أو أنشئ مخيماً جديداً، ثم أضف قطاعاً واحداً على الأقل لبدء إدخال الأسر.</Text>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <Select
            label="المخيم المختار"
            placeholder="اختر مخيماً"
            data={camps.map((camp) => ({ value: camp.id, label: camp.name }))}
            value={campId}
            onChange={selectCamp}
            searchable
          />
          <TextInput
            label="إنشاء مخيم"
            placeholder="اسم المخيم"
            value={campName}
            maxLength={160}
            onChange={(event) => {
              campAttempt.current = null;
              delete campHeaders.current['Idempotency-Key'];
              setCampName(event.currentTarget.value);
            }}
          />
          <Button onClick={submitCamp} disabled={!campName.trim() || createCamp.isPending} loading={createCamp.isPending}>
            إنشاء المخيم
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <TextInput
            label="إضافة قطاع للمخيم المختار"
            placeholder="اسم القطاع"
            value={sectorName}
            maxLength={160}
            disabled={!campId}
            onChange={(event) => {
              sectorAttempt.current = null;
              delete sectorHeaders.current['Idempotency-Key'];
              setSectorName(event.currentTarget.value);
            }}
          />
          <Button onClick={submitSector} disabled={!campId || !sectorName.trim() || createSector.isPending} loading={createSector.isPending}>
            إضافة القطاع
          </Button>
        </div>
        {campId && (
          <Text size="sm" c="dimmed">
            القطاعات الحالية: {campSectors.length ? campSectors.map((sector) => sector.name).join('، ') : 'لا توجد قطاعات بعد'}
          </Text>
        )}
        {setupError && <Alert color="red" title="تعذر إعداد الموقع">{setupError}</Alert>}
        {setupMessage && <Alert color="green">{setupMessage}</Alert>}
      </Card>
      <Card withBorder shadow="sm" radius="lg" className="space-y-4">
        <div>
          <Title order={3} className="text-xl font-display text-primary">استيراد الأسر من ملف Excel</Title>
          <Text size="sm" c="dimmed" mt={4}>
            يُحلل الملف داخل المتصفح فقط. راجع المعاينة ثم أكد الاستيراد؛ تبقى الأسر الجديدة قيد المراجعة ولا يُنشأ حساب لرب الأسرة.
          </Text>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextInput label="المخيم المختار" value={selectedCamp?.name ?? ''} readOnly placeholder="اختر المخيم في إعداد الموقع أعلاه" />
          <div className="flex items-end">
            <Button variant="light" onClick={() => { void downloadTemplate(); }} disabled={!selectedCamp || !hasCampSector} className="w-full">
              تنزيل قالب الأسر .xlsx
            </Button>
          </div>
        </div>
        {!hasCampSector && (
          <Alert color="yellow" title="يلزم إعداد قطاع">
            اختر مخيماً وأضف إليه قطاعاً واحداً على الأقل قبل اختيار ملف الاستيراد أو تنزيل القالب.
          </Alert>
        )}
        <Alert color="blue" icon={<AlertCircle size={18} />} title="إرشادات آمنة">
          <Text size="sm">استخدم ورقتي «الأسر» و«أفراد الأسرة» فقط، واربطهما بمرجع الأسرة. القطاع يطابق اسم المخيم المختار، والمأوى اختياري ويطابق الرمز داخل القطاع. الملف لا يُرفع للخادم؛ تُرسل البيانات بعد التأكيد فقط. تُراجع مطابقة أرقام الهوية مع السجلات الموجودة عند التأكيد، ويُرفض الملف كاملاً عند وجود تعارض.</Text>
        </Alert>
        <FileInput
          label="اختر ملف البيانات"
          placeholder="اختر ملف .xlsx"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          value={file}
          onChange={(value) => { void selectWorkbook(value); }}
          clearable
          disabled={!selectedCamp || !hasCampSector}
        />
        {fileError && <Alert color="red" title="تعذر إكمال الاستيراد">{fileError}</Alert>}
        {successCount != null && <Alert color="green" title="اكتمل الاستيراد">تم استيراد {successCount} أسرة إلى قائمة قيد المراجعة.</Alert>}
        {preview && (
          <div className="space-y-3">
            {preview.errors.length ? (
              <Alert color="red" title={`يحتاج الملف إلى تصحيح (${preview.errors.length})`}>
                <ul className="list-disc pr-5 space-y-1">
                  {preview.errors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
                </ul>
                {preview.duplicateNationalIdRows.length > 0 && (
                  <Text size="sm" mt="xs">صفوف الهويات المكررة: {preview.duplicateNationalIdRows.join('، ')}</Text>
                )}
              </Alert>
            ) : (
              <Alert color="green" title="معاينة الملف جاهزة">
                <Text size="sm">عدد الأسر: {preview.families.length}، عدد الأفراد: {preview.families.reduce((total, family) => total + family.members.length, 0)}، أمثلة مستبعدة: {preview.ignoredExampleCount}.</Text>
                <div className="mt-2 space-y-1">
                  {preview.families.map((family, index) => (
                    <Text key={`${family.headName}-${index}`} size="sm">• {family.headName} — {family.members.length} فرد</Text>
                  ))}
                </div>
              </Alert>
            )}
            {!preview.errors.length && (
              <>
                <Checkbox
                  checked={reviewConfirmed}
                  onChange={(event) => setReviewConfirmed(event.currentTarget.checked)}
                  label="أؤكد أنني راجعت المعاينة، وأن جميع البيانات صحيحة ومصرح بإدخالها."
                />
                <Button
                  onClick={submitImport}
                  disabled={!hasCampSector || !reviewConfirmed || importMutation.isPending}
                  loading={importMutation.isPending}
                  color="teal"
                >
                  تأكيد استيراد {preview.families.length} أسرة
                </Button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function FamilyDetail({ id }: { id: string }) {
  const [location, setLocation] = useLocation();
  const { data: family, isLoading, error } = useGetFamily(id, {
    query: { enabled: !!id, queryKey: ['getFamily', id] }
  });
  
  const { data: needsPage } = useListNeeds();
  const { data: aidsPage } = useListAidDistributions(id);
  
  const familyNeeds = (needsPage || []).filter(n => n.familyId === id);
  const familyAids = aidsPage || [];

  if (isLoading) return <LoadingState message="جاري تحميل بيانات الأسرة..." />;
  if (error || !family) return <ErrorState message="تعذر العثور على الأسرة." />;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/families')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <div>
          <Title order={3} className="text-2xl font-display text-primary">{family.headName}</Title>
          <Text c="dimmed" size="sm">رقم السجل: {family.id.slice(0,8)}</Text>
        </div>
        <Badge color={statusColors[family.status]} size="lg" className="mr-auto">
          {statusLabels[family.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Tabs defaultValue="members" color="teal">
             <Tabs.List>
               <Tabs.Tab value="members" leftSection={<Users size={16} />}>أفراد الأسرة</Tabs.Tab>
               <Tabs.Tab value="needs" leftSection={<ClipboardList size={16} />}>سجل الطلبات</Tabs.Tab>
               <Tabs.Tab value="aids" leftSection={<Package size={16} />}>الاستلامات</Tabs.Tab>
             </Tabs.List>
             
             <Tabs.Panel value="members" pt="md">
                <Card withBorder shadow="sm" radius="lg">
                  {family.members && family.members.length > 0 ? (
                    <div className="space-y-3">
                      {family.members.map(member => (
                        <div key={member.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                              <User size={18} className="text-slate-500" />
                            </div>
                            <div>
                              <Text fw={600} size="sm">{member.fullName}</Text>
                              <Text size="xs" c="dimmed">{member.relationship}</Text>
                            </div>
                          </div>
                          {member.criticalCase && (
                            <Badge color="red" variant="light">حالة حرجة</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text c="dimmed" size="sm" className="text-center py-8">لا يوجد أفراد مسجلين لهذه الأسرة.</Text>
                  )}
                </Card>
             </Tabs.Panel>
             
             <Tabs.Panel value="needs" pt="md">
                <Card withBorder shadow="sm" radius="lg">
                  {familyNeeds.length > 0 ? (
                    <div className="space-y-3">
                      {familyNeeds.map(need => (
                        <div key={need.id} className="p-3 border border-border rounded-lg bg-slate-50">
                           <Text fw={600} size="sm">{need.title}</Text>
                           <Group justify="space-between" mt="sm">
                              <Badge size="sm" variant="dot">{need.status}</Badge>
                              <Text size="xs" c="dimmed">{dayjs(need.createdAt).format('DD MMM YYYY')}</Text>
                           </Group>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text c="dimmed" size="sm" className="text-center py-8">لا توجد طلبات مسجلة.</Text>
                  )}
                </Card>
             </Tabs.Panel>
             
             <Tabs.Panel value="aids" pt="md">
                <Card withBorder shadow="sm" radius="lg">
                  {familyAids.length > 0 ? (
                    <div className="space-y-3">
                      {familyAids.map(aid => (
                        <div key={aid.id} className="p-3 border border-border rounded-lg bg-slate-50">
                           <Text fw={600} size="sm">كمية: {aid.quantity} {aid.unit}</Text>
                           <Group justify="space-between" mt="sm">
                              <Badge size="sm" variant="dot">{aid.status}</Badge>
                              <Text size="xs" c="dimmed">{dayjs(aid.createdAt).format('DD MMM YYYY')}</Text>
                           </Group>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text c="dimmed" size="sm" className="text-center py-8">لم تستلم الأسرة مساعدات بعد.</Text>
                  )}
                </Card>
             </Tabs.Panel>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card withBorder shadow="sm" radius="lg">
            <Title order={4} className="font-display mb-4">معلومات الإيواء</Title>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Home size={20} className="text-primary mt-1" />
                <div>
                  <Text size="sm" c="dimmed">المخيم والقطاع</Text>
                  <Text fw={600}>{family.campId} - {family.sectorId}</Text>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users size={20} className="text-primary mt-1" />
                <div>
                  <Text size="sm" c="dimmed">المندوب المسؤول</Text>
                  <Text fw={600}>{family.delegateId || 'لم يتم التعيين'}</Text>
                </div>
              </div>
            </div>
          </Card>
          
          <Card withBorder shadow="sm" radius="lg">
             <Title order={4} className="font-display mb-4">التاريخ الطبي</Title>
             <Text size="sm" c="dimmed">{family.criticalNotes || 'لا توجد ملاحظات طبية خاصة.'}</Text>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FamilyForm() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: camps } = useListCamps();
  const { data: sectors } = useListSectors();
  const { data: shelters } = useListShelters();
  const { data: delegates } = useListDelegates();

  const [headName, setHeadName] = useState('');
  const [headPhone, setHeadPhone] = useState('');
  const [campId, setCampId] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [shelterId, setShelterId] = useState<string | null>(null);
  const [delegateId, setDelegateId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);
  
  const createFamily = useCreateFamily();

  const handleSubmit = () => {
    if (!headName || !campId || !sectorId) return;

    setSubmitError(false);
    createFamily.mutate({
      data: {
        headName,
        headPhone: headPhone || undefined,
        campId,
        sectorId,
        shelterId: shelterId || null,
        delegateId: delegateId || null,
        members: []
      }
    }, {
      onSuccess: () => {
        setSubmitError(false);
        queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() });
        setLocation('/families');
      },
      onError: () => {
        setSubmitError(true);
      }
    });
  };

  const filteredSectors = (sectors || []).filter(s => s.campId === campId);
  const filteredShelters = (shelters || []).filter(s => s.sectorId === sectorId);

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/families')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <Title order={2} className="text-3xl font-display text-primary">تسجيل أسرة جديدة</Title>
      </div>

      <Card withBorder shadow="sm" radius="lg" p="xl" className="space-y-8">
        <div className="space-y-4">
          <Title order={4} className="text-lg font-display text-sidebar">معلومات رب الأسرة</Title>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              label="الاسم الرباعي" 
              placeholder="الاسم الكامل" 
              required 
              radius="md" 
              value={headName}
              onChange={(e) => setHeadName(e.currentTarget.value)}
            />
            <TextInput 
              label="رقم الهاتف" 
              placeholder="05X XXX XXXX" 
              dir="ltr" 
              className="text-right" 
              radius="md" 
              value={headPhone}
              onChange={(e) => setHeadPhone(e.currentTarget.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <Title order={4} className="text-lg font-display text-sidebar">معلومات الإيواء</Title>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="المخيم" 
              placeholder="اختر المخيم" 
              data={(camps || []).map(c => ({ value: c.id, label: c.name }))} 
              required 
              radius="md" 
              value={campId}
              onChange={(val) => { setCampId(val); setSectorId(null); setShelterId(null); }}
            />
            <Select 
              label="القطاع" 
              placeholder="اختر القطاع" 
              data={filteredSectors.map(s => ({ value: s.id, label: s.name }))} 
              required 
              radius="md" 
              value={sectorId}
              onChange={(val) => { setSectorId(val); setShelterId(null); }}
              disabled={!campId}
            />
            <Select 
              label="وحدة الإيواء (الخيمة)" 
              placeholder="اختر الوحدة" 
              data={filteredShelters.map(s => ({ value: s.id, label: s.code }))} 
              radius="md" 
              value={shelterId}
              onChange={setShelterId}
              disabled={!sectorId}
            />
            <Select 
              label="المندوب الميداني" 
              placeholder="اختر المندوب" 
              data={(delegates?.items || []).map(d => ({ value: d.id.toString(), label: d.name }))} 
              radius="md" 
              value={delegateId}
              onChange={setDelegateId}
            />
          </div>
        </div>

        {submitError && (
          <Alert color="red" icon={<AlertCircle size={18} />} title="تعذر حفظ الأسرة">
            لم نتمكن من حفظ بيانات الأسرة. بقيت بياناتك كما هي؛ راجعها وحاول مرة أخرى.
          </Alert>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" color="gray" onClick={() => setLocation('/families')} radius="md">
            إلغاء
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90" 
            radius="md"
            onClick={handleSubmit}
            disabled={!headName || !campId || !sectorId || createFamily.isPending}
            loading={createFamily.isPending}
          >
            حفظ التسجيل
          </Button>
        </div>
      </Card>
    </div>
  );
}