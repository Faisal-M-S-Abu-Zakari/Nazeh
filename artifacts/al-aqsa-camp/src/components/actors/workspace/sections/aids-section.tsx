import React, { useState } from 'react';
import { useListAids, getListAidsQueryKey, useCreateAid, useListAidDistributions, getListAidDistributionsQueryKey, useListNeeds, getListNeedsQueryKey, useListFamilies, getListFamiliesQueryKey, useCreateAidDistribution, useReceiveAidDistribution } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Button, Card, Table, Text, Badge, ActionIcon, TextInput, Title, Select, NumberInput } from '@mantine/core';
import { Search, ArrowRight, Package, Box, Filter, Plus, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useQueryClient } from '@tanstack/react-query';

dayjs.locale('ar');

const typeLabels: Record<string, string> = { FOOD: "غذائية", WATER: "ماء", MEDICAL: "طبية", SHELTER: "إيواء", HYGIENE: "نظافة", OTHER: "أخرى" };
const typeColors: Record<string, string> = { FOOD: "orange", WATER: "blue", MEDICAL: "red", SHELTER: "teal", HYGIENE: "indigo", OTHER: "gray" };

const distStatusLabels: Record<string, string> = { ASSIGNED: "مُخصص للتسليم", RECEIVED: "تم التسليم", CANCELLED: "ملغى" };
const distStatusColors: Record<string, string> = { ASSIGNED: "orange", RECEIVED: "teal", CANCELLED: "gray" };

export default function AidsSection({ params }: { params?: Record<string, string | undefined> }) {
  if (params?.id === 'new') {
    return <AidForm />;
  }

  if (params?.id) {
    return <AidDetail id={params.id} />;
  }

  return <AidsList />;
}

function AidsList() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const { data: aids, isLoading, error } = useListAids({ 
    query: { queryKey: getListAidsQueryKey() } 
  });

  if (isLoading) return <LoadingState message="جاري تحميل سجل المساعدات..." />;
  if (error) return <ErrorState message="حدث خطأ أثناء تحميل البيانات." />;

  const filtered = (aids || []).filter(a => {
    if (filterType && a.type !== filterType) return false;
    if (search && !a.title.includes(search) && !a.location.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="text-3xl font-display text-primary">المساعدات والتسليم</Title>
          <Text className="text-muted-foreground mt-1">إدارة المخزون وتخصيص المساعدات للأسر المستحقة</Text>
        </div>
        <Link href="/aids/new" className="no-underline">
          <Button leftSection={<Plus size={18} />} size="md" radius="md" className="bg-primary hover:bg-primary/90">
            إضافة مورد جديد
          </Button>
        </Link>
      </div>

      <Card withBorder shadow="sm" radius="lg" className="overflow-hidden bg-white dark:bg-card">
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-4">
          <TextInput
            placeholder="ابحث باسم المساعدة أو المستودع..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="flex-1 min-w-[200px]"
            radius="md"
          />
          <Select
            placeholder="تصفية حسب النوع"
            data={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))}
            value={filterType}
            onChange={setFilterType}
            clearable
            radius="md"
            leftSection={<Filter size={16} />}
            className="w-48"
          />
        </div>

        <div className="overflow-x-auto">
          <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>المورد (المساعدة)</Table.Th>
                <Table.Th>التصنيف</Table.Th>
                <Table.Th>الكمية المتاحة</Table.Th>
                <Table.Th>الموقع (المستودع)</Table.Th>
                <Table.Th>تاريخ التوزيع</Table.Th>
                <Table.Th className="text-left">الإجراءات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length > 0 ? (
                filtered.map((aid) => (
                  <Table.Tr key={aid.id} className="group">
                    <Table.Td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary">
                          <Package size={20} />
                        </div>
                        <div>
                          <Text fw={600} size="sm">{aid.title}</Text>
                          <Text size="xs" c="dimmed">معرف: {aid.id.slice(0, 8)}</Text>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={typeColors[aid.type]} size="sm">
                        {typeLabels[aid.type]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <div className="flex items-baseline gap-1">
                        <Text fw={700} size="lg">{aid.quantity}</Text>
                        <Text size="xs" c="dimmed">{aid.unit}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{aid.location}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {dayjs(aid.distributionDate).format('DD MMM YYYY')}
                      </Text>
                    </Table.Td>
                    <Table.Td className="text-left">
                      <Button 
                        variant="light" 
                        color="primary" 
                        size="xs" 
                        radius="md"
                        onClick={() => setLocation(`/aids/${aid.id}`)}
                      >
                        إدارة التوزيع
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={6} className="text-center py-10">
                    <Text c="dimmed">لا توجد مساعدات تطابق بحثك.</Text>
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

function AidDetail({ id }: { id: string }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Queries
  const { data: aidsList, isLoading: aidsLoading } = useListAids({ 
    query: { queryKey: getListAidsQueryKey() } 
  });
  const { data: distsData, isLoading: distsLoading } = useListAidDistributions(id, {
    query: { queryKey: getListAidDistributionsQueryKey(id), enabled: !!id }
  });
  
  // Need to get families and needs for assigning
  const families = useListFamilies({ query: { queryKey: getListFamiliesQueryKey() } });
  const needs = useListNeeds({ query: { queryKey: getListNeedsQueryKey() } });
  
  // State for assignment form
  const [targetFamilyId, setTargetFamilyId] = useState<string | null>(null);
  const [targetNeedId, setTargetNeedId] = useState<string | null>(null);
  const [assignQty, setAssignQty] = useState<number | ''>(1);
  
  // Mutations
  const createDist = useCreateAidDistribution();
  const receiveDist = useReceiveAidDistribution();
  
  const aid = (aidsList || []).find(a => a.id === id);

  if (aidsLoading || distsLoading) return <LoadingState message="جاري تحميل التفاصيل..." />;
  if (!aid) return <ErrorState message="تعذر العثور على المساعدة." />;

  const dists = distsData || [];
  const assignedTotal = dists.reduce((acc, curr) => acc + curr.quantity, 0);
  const availableQty = aid.quantity - assignedTotal;

  const handleAssign = () => {
    if (!targetFamilyId || !targetNeedId || !assignQty || assignQty <= 0) return;
    createDist.mutate({
      aidId: id,
      data: {
        familyId: targetFamilyId,
        needId: targetNeedId,
        quantity: Number(assignQty)
      }
    }, {
      onSuccess: () => {
        setTargetFamilyId(null);
        setTargetNeedId(null);
        setAssignQty(1);
        queryClient.invalidateQueries({ queryKey: getListAidDistributionsQueryKey(id) });
      }
    });
  };

  const handleReceive = (distId: string) => {
    receiveDist.mutate({ distributionId: distId, data: {} }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAidDistributionsQueryKey(id) });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/aids')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <div>
          <Title order={3} className="text-2xl font-display text-primary">إدارة المساعدة والتوزيع</Title>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card withBorder shadow="sm" radius="lg" className="md:col-span-2 space-y-6">
          <div className="flex justify-between items-start border-b border-border pb-4">
            <div>
              <Title order={2} className="font-display">{aid.title}</Title>
              <Text size="sm" c="dimmed" className="mt-1">الموقع: {aid.location}</Text>
            </div>
            <Badge variant="light" color={typeColors[aid.type]} size="xl">
              {typeLabels[aid.type]}
            </Badge>
          </div>
          
          <div>
            <Title order={4} className="font-display mb-4 text-sidebar">تخصيص لأسرة جديدة</Title>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="الأسرة"
                  placeholder="اختر الأسرة"
                  data={(families.data || []).map(f => ({ value: f.id, label: f.headName }))}
                  value={targetFamilyId}
                  onChange={(val) => { setTargetFamilyId(val); setTargetNeedId(null); }}
                  searchable
                />
                <Select
                  label="طلب الاحتياج"
                  placeholder="اختر طلب معتمد"
                  data={(needs.data || [])
                    .filter(n => n.familyId === targetFamilyId && (n.status === 'APPROVED' || n.status === 'REQUIRED'))
                    .map(n => ({ value: n.id, label: n.title }))}
                  value={targetNeedId}
                  onChange={setTargetNeedId}
                  disabled={!targetFamilyId}
                />
              </div>
              <div className="flex items-end gap-4">
                <NumberInput 
                  label="الكمية للتخصيص" 
                  value={assignQty} 
                  onChange={(val) => setAssignQty(val as number | '')} 
                  min={1} 
                  max={availableQty} 
                  className="w-32" 
                />
                <Button 
                  className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none"
                  onClick={handleAssign}
                  disabled={!targetFamilyId || !targetNeedId || !assignQty || createDist.isPending || assignQty > availableQty}
                  loading={createDist.isPending}
                >
                  حفظ التخصيص
                </Button>
              </div>
            </div>
          </div>
          
          <div>
             <Title order={4} className="font-display mb-4 text-sidebar">سجل التوزيع الحالي</Title>
             <div className="space-y-3">
               {dists.length > 0 ? dists.map(dist => (
                 <div key={dist.id} className="flex justify-between items-center p-3 rounded-lg border border-border">
                   <div>
                     <Text fw={600} size="sm">
                       {(families.data || []).find(f => f.id === dist.familyId)?.headName || dist.familyId.slice(0, 8)}
                     </Text>
                     <Text size="xs" c="dimmed">
                       الكمية: {dist.quantity} {dist.unit} · {dayjs(dist.createdAt).format('DD MMM YYYY')}
                     </Text>
                   </div>
                   <div className="flex items-center gap-3">
                     <Badge color={distStatusColors[dist.status]} variant="light">
                       {distStatusLabels[dist.status]}
                     </Badge>
                     {dist.status === 'ASSIGNED' && (
                       <Button size="xs" color="teal" onClick={() => handleReceive(dist.id)} loading={receiveDist.isPending}>
                         تأكيد التسليم
                       </Button>
                     )}
                   </div>
                 </div>
               )) : (
                 <Text c="dimmed" size="sm" className="text-center py-4">لم يتم تخصيص أي كميات بعد.</Text>
               )}
             </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card withBorder shadow="sm" radius="lg" className="bg-primary text-white">
            <div className="flex items-center gap-3 mb-6">
              <Box size={24} className="opacity-80" />
              <Title order={4} className="font-display text-white">حالة المخزون</Title>
            </div>
            
            <div className="space-y-4">
              <div>
                <Text size="xs" className="opacity-70 mb-1">الكمية الإجمالية</Text>
                <div className="flex items-baseline gap-1">
                  <Text className="text-4xl font-bold font-display">{aid.quantity}</Text>
                  <Text size="sm" className="opacity-80">{aid.unit}</Text>
                </div>
              </div>
              
              <div className="flex justify-between border-t border-white/20 pt-4">
                <div>
                  <Text size="xs" className="opacity-70">المخصص</Text>
                  <Text className="text-xl font-bold font-display">{assignedTotal}</Text>
                </div>
                <div>
                  <Text size="xs" className="opacity-70">المتاح للتوزيع</Text>
                  <Text className="text-xl font-bold font-display text-secondary">{availableQty}</Text>
                </div>
              </div>
            </div>
          </Card>
          
          <Card withBorder shadow="sm" radius="lg">
             <Title order={4} className="font-display mb-4 text-sidebar">معلومات إضافية</Title>
             <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-muted-foreground" />
                  <Text size="sm">تاريخ التوزيع المخطط: {dayjs(aid.distributionDate).format('DD MMMM YYYY')}</Text>
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AidForm() {
  const [location, setLocation] = useLocation();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>('FOOD');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('');
  const [distLocation, setDistLocation] = useState('');
  
  const createAid = useCreateAid();
  const queryClient = useQueryClient();

  const handleSubmit = () => {
    if (!title || !quantity || !unit || !distLocation) return;
    createAid.mutate({
      data: {
        title, type: type as any, quantity: Number(quantity), unit, location: distLocation, distributionDate: new Date().toISOString()
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAidsQueryKey() });
        setLocation('/aids');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/aids')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <Title order={2} className="text-3xl font-display text-primary">تسجيل مورد مساعدة جديد</Title>
      </div>
      <Card withBorder shadow="sm" radius="lg" p="xl" className="space-y-6">
         <TextInput label="اسم / وصف المساعدة" placeholder="مثال: طرود غذائية طارئة" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <Select 
             label="التصنيف" 
             placeholder="اختر الفئة" 
             data={Object.entries(typeLabels).map(([v, l]) => ({ value: v, label: l }))} 
             required 
             value={type}
             onChange={(val) => setType(val || 'FOOD')}
           />
           <TextInput label="الموقع / المستودع" placeholder="مثال: المستودع الرئيسي أ" required value={distLocation} onChange={(e) => setDistLocation(e.currentTarget.value)} />
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <NumberInput label="الكمية الإجمالية" placeholder="العدد" required min={1} value={quantity} onChange={(val) => setQuantity(val as number | '')} />
           <TextInput label="وحدة القياس" placeholder="مثال: طرد، صندوق، بطانية" required value={unit} onChange={(e) => setUnit(e.currentTarget.value)} />
         </div>
         
         <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" color="gray" onClick={() => setLocation('/aids')} radius="md">
            إلغاء
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90" 
            radius="md"
            onClick={handleSubmit}
            disabled={!title || !quantity || !unit || !distLocation || createAid.isPending}
            loading={createAid.isPending}
          >
            إضافة للمخزون
          </Button>
        </div>
         {createAid.isError && (
           <Text c="red" size="sm">تعذر إضافة المورد. راجع البيانات وحاول مرة أخرى.</Text>
         )}
      </Card>
    </div>
  );
}