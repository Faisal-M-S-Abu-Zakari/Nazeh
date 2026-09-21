import React, { useState } from 'react';
import { useListFamilies, useGetFamily, getListFamiliesQueryKey, useListCamps, useListSectors, useListShelters, useListDelegates, useCreateFamily, useListNeeds, useListAidDistributions } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Button, Card, Table, Text, Badge, ActionIcon, Group, TextInput, Select, Title, Tabs } from '@mantine/core';
import { Search, Plus, ArrowRight, Eye, User, Home, Users, ClipboardList, Package } from 'lucide-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import { cn } from '@/utils/cn';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useQueryClient } from '@tanstack/react-query';

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
  
  const createFamily = useCreateFamily();

  const handleSubmit = () => {
    if (!headName || !campId || !sectorId) return;
    
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
        queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() });
        setLocation('/families');
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