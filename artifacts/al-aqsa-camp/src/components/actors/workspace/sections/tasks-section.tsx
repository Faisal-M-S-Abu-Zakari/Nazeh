import React, { useState } from 'react';
import { useListTasks, getListTasksQueryKey, useSubmitTask, useApproveTask, useCreateSyncTask, useListSecurityMembers } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Button, Card, Table, Text, Badge, ActionIcon, TextInput, Title, Select, Modal, Textarea } from '@mantine/core';
import { Search, ArrowRight, ShieldCheck, Filter, Plus, CheckCircle2, PlayCircle } from 'lucide-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useQueryClient } from '@tanstack/react-query';
import useAuth from '@/hooks/useAuth';

dayjs.locale('ar');

const priorityLabels: Record<string, string> = { LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", URGENT: "عاجلة جداً" };
const priorityColors: Record<string, string> = { LOW: "gray", MEDIUM: "blue", HIGH: "orange", URGENT: "red" };

const statusLabels: Record<string, string> = { PENDING: "قيد الانتظار", IN_PROGRESS: "قيد التنفيذ", COMPLETED: "مكتملة", CANCELLED: "ملغاة" };
const statusColors: Record<string, string> = { PENDING: "orange", IN_PROGRESS: "indigo", COMPLETED: "teal", CANCELLED: "gray" };

export default function TasksSection({ params }: { params?: Record<string, string | undefined> }) {
  if (params?.id === 'new') {
    return <TaskForm />;
  }

  if (params?.id) {
    return <TaskDetail id={params.id} />;
  }

  return <TasksList />;
}

function TasksList() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const { isSecurityOfficer, isManager } = useAuth();
  const { data: tasks, isLoading, error } = useListTasks({ 
    query: { queryKey: getListTasksQueryKey() } 
  });

  if (isLoading) return <LoadingState message="جاري تحميل المهام الأمنية..." />;
  if (error) return <ErrorState message="حدث خطأ أثناء تحميل البيانات." />;

  const filtered = (tasks || []).filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (search && !t.title.includes(search) && !t.location.includes(search)) return false;
    return true;
  });

  const canCreate = isManager || isSecurityOfficer;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="text-3xl font-display text-primary">المهام الأمنية والميدانية</Title>
          <Text className="text-muted-foreground mt-1">إدارة وتتبع المهام المسندة للفريق الأمني</Text>
        </div>
        {canCreate && (
          <Link href="/tasks/new" className="no-underline">
            <Button leftSection={<Plus size={18} />} size="md" radius="md" className="bg-primary hover:bg-primary/90">
              إضافة مهمة جديدة
            </Button>
          </Link>
        )}
      </div>

      <Card withBorder shadow="sm" radius="lg" className="overflow-hidden bg-white dark:bg-card">
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-4">
          <TextInput
            placeholder="ابحث بعنوان المهمة أو الموقع..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="flex-1 min-w-[200px]"
            radius="md"
          />
          <Select
            placeholder="تصفية حسب الحالة"
            data={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
            value={filterStatus}
            onChange={setFilterStatus}
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
                <Table.Th>المهمة</Table.Th>
                <Table.Th>الموقع</Table.Th>
                <Table.Th>الأولوية</Table.Th>
                <Table.Th>تاريخ الاستحقاق</Table.Th>
                <Table.Th>الحالة</Table.Th>
                <Table.Th className="text-left">الإجراءات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length > 0 ? (
                filtered.map((task) => (
                  <Table.Tr key={task.id} className="group">
                    <Table.Td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <Text fw={600} size="sm">{task.title}</Text>
                          <Text size="xs" c="dimmed">المعرف: {task.id.slice(0, 8)}</Text>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{task.location}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={priorityColors[task.priority]} size="sm">
                        {priorityLabels[task.priority]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{task.dueAt ? dayjs(task.dueAt).format('DD MMM YYYY') : 'غير محدد'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[task.status]} variant={task.status === 'COMPLETED' ? 'filled' : 'light'} size="sm">
                        {statusLabels[task.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td className="text-left">
                      <Button 
                        variant="light" 
                        color="primary" 
                        size="xs" 
                        radius="md"
                        onClick={() => setLocation(`/tasks/${task.id}`)}
                      >
                        إدارة المهمة
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={6} className="text-center py-10">
                    <Text c="dimmed">لا توجد مهام تطابق بحثك.</Text>
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

function TaskDetail({ id }: { id: string }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isSecurityOfficer } = useAuth();
  
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [taskResult, setTaskResult] = useState('');
  
  const { data: tasks, isLoading } = useListTasks({ 
    query: { queryKey: getListTasksQueryKey() } 
  });
  
  const submitTask = useSubmitTask();
  const approveTask = useApproveTask();
  
  const task = (tasks || []).find(t => t.id === id);

  if (isLoading) return <LoadingState message="جاري تحميل التفاصيل..." />;
  if (!task) return <ErrorState message="تعذر العثور على المهمة." />;

  const handleSubmitResult = () => {
    if (!taskResult) return;
    submitTask.mutate({ 
      taskId: id, 
      data: { result: taskResult, expectedVersion: task.version } 
    }, {
      onSuccess: () => {
        setSubmitModalOpen(false);
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      }
    });
  };

  const handleApprove = () => {
    approveTask.mutate({
      taskId: id,
      data: { expectedVersion: task.version, note: 'Approved by officer' }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/tasks')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <div>
          <Title order={3} className="text-2xl font-display text-primary">تفاصيل المهمة الأمنية</Title>
        </div>
      </div>

      <Card withBorder shadow="sm" radius="lg" p="xl" className="space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <Title order={2} className="mb-2 font-display">{task.title}</Title>
            <div className="flex gap-2 mb-4">
              <Badge variant="light" color={priorityColors[task.priority]} size="md">{priorityLabels[task.priority]}</Badge>
              <Badge variant="filled" color={statusColors[task.status]} size="md">{statusLabels[task.status]}</Badge>
            </div>
          </div>
          <Text size="sm" c="dimmed">الاستحقاق: {task.dueAt ? dayjs(task.dueAt).format('DD MMM YYYY') : 'غير محدد'}</Text>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Text size="sm" c="dimmed">الموقع المستهدف</Text>
              <Text fw={600}>{task.location}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">الفرد المكلف</Text>
              <Text fw={600}>{task.assignedToId || 'غير محدد'}</Text>
            </div>
          </div>
          <Text fw={600} className="mb-1 mt-4">الوصف التفصيلي:</Text>
          <Text className="text-muted-foreground whitespace-pre-wrap">{task.description}</Text>
        </div>
        
        {task.result && (
          <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 border border-teal-200 dark:border-teal-800">
            <Text fw={600} className="mb-1 text-teal-800 dark:text-teal-300">نتيجة التنفيذ الميداني:</Text>
            <Text className="text-teal-900 dark:text-teal-100 whitespace-pre-wrap">{task.result}</Text>
            {task.submittedAt && (
              <Text size="xs" className="mt-2 text-teal-700/70">تاريخ الرفع: {dayjs(task.submittedAt).format('DD MMM YYYY HH:mm')}</Text>
            )}
          </div>
        )}

        <div className="border-t border-border pt-6">
          <Title order={4} className="font-display mb-4 text-sidebar">إجراءات المتابعة</Title>
          <div className="flex flex-wrap gap-3">
            {task.status !== 'COMPLETED' && (
              <Button leftSection={<CheckCircle2 size={16} />} color="teal" onClick={() => setSubmitModalOpen(true)}>
                رفع نتيجة التنفيذ
              </Button>
            )}
            
            {isSecurityOfficer && task.status === 'COMPLETED' && !task.approvedAt && (
              <Button leftSection={<CheckCircle2 size={16} />} color="blue" onClick={handleApprove} loading={approveTask.isPending}>
                اعتماد إكمال المهمة
              </Button>
            )}
            
            {task.approvedAt && (
              <Badge color="blue" size="lg" variant="dot" className="px-4">تم اعتماد المهمة بواسطة الإدارة</Badge>
            )}
          </div>
        </div>
      </Card>

      <Modal opened={submitModalOpen} onClose={() => setSubmitModalOpen(false)} title="رفع نتيجة تنفيذ المهمة" centered dir="rtl">
        <div className="space-y-4">
          <Textarea 
            label="النتيجة أو الملاحظات" 
            placeholder="اكتب تقرير التنفيذ أو أي ملاحظات هامة..." 
            value={taskResult} 
            onChange={(e) => setTaskResult(e.currentTarget.value)}
            minRows={4}
            required
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" color="gray" onClick={() => setSubmitModalOpen(false)}>إلغاء</Button>
            <Button color="teal" onClick={handleSubmitResult} loading={submitTask.isPending} disabled={!taskResult}>
              حفظ النتيجة
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskForm() {
  const [location, setLocation] = useLocation();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [taskLocation, setTaskLocation] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState(dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm'));
  
  const queryClient = useQueryClient();
  const createTask = useCreateSyncTask();
  const { data: members, isLoading: membersLoading } = useListSecurityMembers();

  const handleSubmit = () => {
    if (!title || !priority || !taskLocation || !description || !dueAt) return;
    
    createTask.mutate({
      data: {
        title,
        priority: priority as any,
        location: taskLocation,
        description,
        assignedToId: assignedToId || null,
        dueAt: new Date(dueAt).toISOString(),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setLocation('/tasks');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/tasks')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <Title order={2} className="text-3xl font-display text-primary">إسناد مهمة أمنية</Title>
      </div>
      <Card withBorder shadow="sm" radius="lg" p="xl" className="space-y-6">
         <TextInput 
           label="عنوان المهمة" 
           placeholder="مثال: تأمين موقع التوزيع الشمالي" 
           required 
           value={title}
           onChange={(e) => setTitle(e.currentTarget.value)}
         />
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <Select 
             label="الأولوية" 
             placeholder="مستوى الأهمية" 
             data={Object.entries(priorityLabels).map(([v, l]) => ({ value: v, label: l }))} 
             required 
             value={priority}
             onChange={(v) => setPriority(v || 'MEDIUM')}
           />
           <TextInput 
             label="الموقع" 
             placeholder="تحديد المكان بدقة" 
             required 
             value={taskLocation}
             onChange={(e) => setTaskLocation(e.currentTarget.value)}
           />
         </div>

         <Select 
           label="إسناد إلى فرد أمن (اختياري)" 
           placeholder="اختر الفرد" 
           data={(members || []).map(m => ({ value: m.id.toString(), label: m.name }))}
           value={assignedToId}
           onChange={setAssignedToId}
           disabled={membersLoading}
         />

         <TextInput
           label="موعد إنجاز المهمة"
           type="datetime-local"
           required
           value={dueAt}
           onChange={(event) => setDueAt(event.currentTarget.value)}
         />
         
         <Textarea 
           label="التفاصيل والتعليمات" 
           placeholder="وصف مفصل لما يجب القيام به..." 
           minRows={4} 
           required 
           value={description}
           onChange={(e) => setDescription(e.currentTarget.value)}
         />
         
         <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" color="gray" onClick={() => setLocation('/tasks')} radius="md">
            إلغاء
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90" 
            radius="md" 
            onClick={handleSubmit}
             disabled={!title || !priority || !taskLocation || !description || !dueAt || createTask.isPending}
            loading={createTask.isPending}
          >
            حفظ وإسناد
          </Button>
        </div>
         {createTask.isError && (
           <Text c="red" size="sm">تعذر حفظ المهمة. راجع البيانات وحاول مرة أخرى.</Text>
         )}
      </Card>
    </div>
  );
}