import React, { useRef, useState } from 'react';
import { useListNeeds, useGetFamily, getListNeedsQueryKey, useUpdateNeed, useListFamilies, getListFamiliesQueryKey, useCreateNeed } from '@workspace/api-client-react';
import type { NeedInput } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Alert, Button, Card, Table, Text, Badge, ActionIcon, TextInput, Title, Select, Modal, Textarea } from '@mantine/core';
import { Search, Eye, Filter, ArrowRight, CheckCircle2, Clock, XCircle, AlertCircle, PlayCircle } from 'lucide-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import {
  NEED_SUBMISSION_ERROR_MESSAGE,
  NEED_SUBMISSION_ERROR_TITLE,
  submitNeed,
} from './needs-submission';
import {
  FAMILY_LIST_LOAD_ERROR_MESSAGE,
  FAMILY_LIST_LOAD_ERROR_TITLE,
  canSubmitNeed,
} from './needs-family-state';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useQueryClient } from '@tanstack/react-query';
import useAuth from '@/hooks/useAuth';

dayjs.locale('ar');

const categoryLabels: Record<string, string> = { FOOD: "غذاء", WATER: "ماء", MEDICAL: "رعاية طبية", SHELTER: "مأوى", HYGIENE: "نظافة", OTHER: "أخرى" };
const statusLabels: Record<string, string> = { REQUIRED: "مطلوب", APPROVED: "تمت الموافقة", IN_PROGRESS: "قيد التنفيذ", FULFILLED: "مكتمل", CANCELLED: "ملغى" };
const statusColors: Record<string, string> = { REQUIRED: "orange", APPROVED: "blue", IN_PROGRESS: "indigo", FULFILLED: "teal", CANCELLED: "gray" };

const priorityLabels: Record<string, string> = { LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", CRITICAL: "طارئة" };
const priorityColors: Record<string, string> = { LOW: "gray", MEDIUM: "blue", HIGH: "orange", CRITICAL: "red" };

export default function NeedsSection({ params }: { params?: Record<string, string | undefined> }) {
  if (params?.id === 'new') {
    return <NeedForm />;
  }

  if (params?.id) {
    return <NeedDetail id={params.id} />;
  }

  return <NeedsList />;
}

function NeedsList() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const { isManager, isDelegate } = useAuth();
  const { data: needs, isLoading, error } = useListNeeds({ 
    query: { queryKey: getListNeedsQueryKey() } 
  });

  if (isLoading) return <LoadingState message="جاري تحميل الاحتياجات والطلبات..." />;
  if (error) return <ErrorState message="حدث خطأ أثناء تحميل البيانات." />;

  const filtered = (needs || []).filter(n => {
    if (filterCategory && n.category !== filterCategory) return false;
    if (search && !n.title.includes(search) && !n.id.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="text-3xl font-display text-primary">الاحتياجات والطلبات</Title>
          <Text className="text-muted-foreground mt-1">إدارة طلبات الأسر والاحتياجات الميدانية العاجلة</Text>
        </div>
        {(isManager || isDelegate) && (
          <Button onClick={() => setLocation('/needs/new')} className="bg-primary hover:bg-primary/90" radius="md">
            طلب احتياج جديد
          </Button>
        )}
      </div>

      <Card withBorder shadow="sm" radius="lg" className="overflow-hidden bg-white dark:bg-card">
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-4">
          <TextInput
            placeholder="ابحث باسم الطلب أو المعرف..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="flex-1 min-w-[200px]"
            radius="md"
          />
          <Select
            placeholder="تصفية حسب الفئة"
            data={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))}
            value={filterCategory}
            onChange={setFilterCategory}
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
                <Table.Th>الطلب</Table.Th>
                <Table.Th>الفئة والأولوية</Table.Th>
                <Table.Th>تاريخ الطلب</Table.Th>
                <Table.Th>الحالة</Table.Th>
                <Table.Th className="text-left">الإجراءات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length > 0 ? (
                filtered.map((need) => (
                  <Table.Tr key={need.id} className="group">
                    <Table.Td>
                      <div className="flex flex-col">
                        <Text fw={600} size="sm">{need.title}</Text>
                        <Text size="xs" c="dimmed">أسرة: {need.familyId.slice(0, 8)}...</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div className="flex gap-2">
                        <Badge variant="outline" color="gray" size="sm">{categoryLabels[need.category]}</Badge>
                        <Badge variant="light" color={priorityColors[need.priority]} size="sm">
                          {priorityLabels[need.priority]}
                        </Badge>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{dayjs(need.createdAt).format('DD MMM YYYY')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[need.status]} variant="filled" size="sm">
                        {statusLabels[need.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td className="text-left">
                      <Button 
                        variant="light" 
                        color="primary" 
                        size="xs" 
                        radius="md"
                        onClick={() => setLocation(`/needs/${need.id}`)}
                      >
                        التفاصيل
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5} className="text-center py-10">
                    <Text c="dimmed">لا توجد طلبات تطابق بحثك.</Text>
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

function NeedDetail({ id }: { id: string }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateNote, setUpdateNote] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [updateError, setUpdateError] = useState(false);
  
  const { data: needs, isLoading } = useListNeeds({ 
    query: { queryKey: getListNeedsQueryKey() } 
  });
  
  const updateNeed = useUpdateNeed();
  
  const need = (needs || []).find(n => n.id === id);

  if (isLoading) return <LoadingState message="جاري تحميل تفاصيل الطلب..." />;
  if (!need) return <ErrorState message="تعذر العثور على الطلب." />;

  const handleStatusUpdate = () => {
    if (!newStatus) return;
    setUpdateError(false);
    updateNeed.mutate({ 
      needId: need.id, 
      data: { status: newStatus as any, note: updateNote, expectedVersion: need.version } 
    }, {
      onSuccess: () => {
         setUpdateError(false);
        setUpdateModalOpen(false);
        queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() });
       },
       onError: () => {
         setUpdateError(true);
      }
    });
  };

  const openStatusUpdate = (status: string) => {
    setNewStatus(status);
    setUpdateNote('');
    setUpdateError(false);
    setUpdateModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/needs')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <div>
          <Title order={3} className="text-2xl font-display text-primary">تفاصيل الطلب</Title>
        </div>
      </div>

      <Card withBorder shadow="sm" radius="lg" p="xl" className="space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <Title order={2} className="mb-2 font-display">{need.title}</Title>
            <div className="flex gap-2 mb-4">
              <Badge variant="outline" size="md">{categoryLabels[need.category]}</Badge>
              <Badge variant="light" color={priorityColors[need.priority]} size="md">{priorityLabels[need.priority]}</Badge>
              <Badge variant="filled" color={statusColors[need.status]} size="md">{statusLabels[need.status]}</Badge>
            </div>
          </div>
          <Text size="sm" c="dimmed">{dayjs(need.createdAt).format('DD MMM YYYY HH:mm')}</Text>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-border">
          <Text fw={600} className="mb-2">وصف الطلب:</Text>
          <Text className="text-muted-foreground whitespace-pre-wrap">{need.description || 'لا يوجد تفاصيل إضافية.'}</Text>
        </div>

        <div className="border-t border-border pt-6">
          <Title order={4} className="font-display mb-4 text-sidebar">إجراءات المتابعة</Title>
          <div className="flex flex-wrap gap-3">
            {need.status === 'REQUIRED' && (
              <Button leftSection={<CheckCircle2 size={16} />} color="blue" onClick={() => openStatusUpdate('APPROVED')}>
                موافقة مبدئية
              </Button>
            )}
            {(need.status === 'REQUIRED' || need.status === 'APPROVED') && (
              <Button leftSection={<PlayCircle size={16} />} color="indigo" onClick={() => openStatusUpdate('IN_PROGRESS')}>
                البدء بالتنفيذ
              </Button>
            )}
            {need.status === 'IN_PROGRESS' && (
              <Button leftSection={<CheckCircle2 size={16} />} color="teal" onClick={() => openStatusUpdate('FULFILLED')}>
                تأكيد التسليم / الاكتمال
              </Button>
            )}
            {need.status !== 'CANCELLED' && need.status !== 'FULFILLED' && (
              <Button variant="light" color="red" leftSection={<XCircle size={16} />} onClick={() => openStatusUpdate('CANCELLED')}>
                إلغاء الطلب
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Modal opened={updateModalOpen} onClose={() => setUpdateModalOpen(false)} title="تحديث حالة الطلب" centered dir="rtl">
        <div className="space-y-4">
          {updateError && (
            <Alert color="red" icon={<AlertCircle size={18} />} title="تعذر تحديث حالة الطلب">
              لم تتغير حالة الطلب. بقيت البيانات كما هي؛ راجعها وحاول مرة أخرى.
            </Alert>
          )}
          <Text>هل أنت متأكد من تغيير حالة الطلب إلى <Badge color={statusColors[newStatus]}>{statusLabels[newStatus]}</Badge>؟</Text>
          <Textarea 
            label="ملاحظات (اختياري)" 
            placeholder="أضف ملاحظة توضح سبب التغيير..." 
            value={updateNote} 
            onChange={(e) => setUpdateNote(e.currentTarget.value)}
            minRows={3}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" color="gray" onClick={() => setUpdateModalOpen(false)}>إلغاء</Button>
            <Button color={statusColors[newStatus]} onClick={handleStatusUpdate} loading={updateNeed.isPending}>
              تأكيد التحديث
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function NeedForm() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const {
    data: families,
    isLoading: familiesLoading,
    isError: familiesError,
    refetch: refetchFamilies,
    isFetching: familiesFetching,
  } = useListFamilies({
    query: { queryKey: getListFamiliesQueryKey() },
  });
  const createNeed = useCreateNeed();
  
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('FOOD');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState(false);
  
  const handleSubmit = () => {
    if (!canSubmitNeed({
      familyId,
      familiesLoading,
      familiesError,
      familyCount: families?.length ?? 0,
    })) {
      return;
    }

    const values: NeedInput = {
      familyId: familyId || '',
      category: category as NeedInput['category'],
      priority: priority as NeedInput['priority'],
      title,
      description,
    };

    submitNeed(values, {
      mutate: (variables, callbacks) => createNeed.mutate(variables, callbacks),
      setSubmitError,
      invalidateNeeds: () => {
        void queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() });
      },
      navigate: setLocation,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/needs')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <Title order={2} className="text-3xl font-display text-primary">تسجيل طلب جديد</Title>
      </div>
      <Card withBorder shadow="sm" radius="lg" p="xl" className="space-y-6">
         {familiesError && (
           <Alert color="red" icon={<AlertCircle size={18} />} title={FAMILY_LIST_LOAD_ERROR_TITLE}>
             <div className="space-y-3">
               <Text size="sm">{FAMILY_LIST_LOAD_ERROR_MESSAGE}</Text>
               <Button
                 variant="light"
                 color="red"
                 size="sm"
                 onClick={() => void refetchFamilies()}
                 loading={familiesFetching}
               >
                 إعادة تحميل قائمة الأسر
               </Button>
             </div>
           </Alert>
         )}
         {!familiesError && !familiesLoading && (families || []).length === 0 && (
           <Alert color="yellow" icon={<AlertCircle size={18} />} title="لا توجد أسر مستفيدة">
             لا يمكن تسجيل طلب احتياج قبل توفر أسرة مستفيدة. أعد تحميل القائمة بعد إضافة الأسرة.
           </Alert>
         )}
         <Select 
           label="الأسرة المستفيدة" 
           placeholder="ابحث عن اسم أو رقم الأسرة..." 
           data={(families || []).map(f => ({ value: f.id, label: `${f.headName} - ${f.id.slice(0,8)}` }))} 
           required 
           searchable
           value={familyId}
           onChange={setFamilyId}
           disabled={familiesLoading || familiesError || (families || []).length === 0}
         />
         <Select 
           label="فئة الطلب" 
           placeholder="اختر الفئة" 
           data={Object.entries(categoryLabels).map(([v, l]) => ({ value: v, label: l }))} 
           required 
           value={category}
           onChange={(val) => setCategory(val || 'FOOD')}
         />
         <Select 
           label="الأولوية" 
           placeholder="مستوى الخطورة" 
           data={Object.entries(priorityLabels).map(([v, l]) => ({ value: v, label: l }))} 
           required 
           value={priority}
           onChange={(val) => setPriority(val || 'MEDIUM')}
         />
         <TextInput 
           label="عنوان الطلب" 
           placeholder="مثال: حليب أطفال وحفاظات" 
           required 
           value={title}
           onChange={(e) => setTitle(e.currentTarget.value)}
         />
         <Textarea 
           label="وصف تفصيلي" 
           placeholder="أية تفاصيل تساعد في تقييم الطلب وتلبيته..." 
           minRows={4} 
           required
           value={description}
           onChange={(e) => setDescription(e.currentTarget.value)}
         />
           {submitError && (
             <Alert color="red" icon={<AlertCircle size={18} />} title={NEED_SUBMISSION_ERROR_TITLE}>
               {NEED_SUBMISSION_ERROR_MESSAGE}
            </Alert>
          )}
         <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" color="gray" onClick={() => setLocation('/needs')} radius="md">
            إلغاء
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90" 
            radius="md"
            onClick={handleSubmit}
            disabled={
              !canSubmitNeed({
                familyId,
                familiesLoading,
                familiesError,
                familyCount: families?.length ?? 0,
              }) ||
              !category ||
              !title ||
              !description ||
              !priority ||
              createNeed.isPending
            }
            loading={createNeed.isPending}
          >
            إرسال الطلب
          </Button>
        </div>
      </Card>
    </div>
  );
}
