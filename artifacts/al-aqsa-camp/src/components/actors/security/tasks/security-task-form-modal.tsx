'use client';

import {
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  Select,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import { useEffect, useState } from 'react';
import { Send, X, ShieldAlert, Clock4, FileText, UserCheck, ClipboardList } from 'lucide-react';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';
import { Task } from '@/@types/actors/security/tasks/TasksResponse.type';
import { useQueryClient } from '@tanstack/react-query';
import { TASKS_TABS } from '@/@types/actors/common-types/index.type';
import { getListTasksQueryKey, TaskPriority, TaskStatus, useCreateSyncTask, useListSecurityOfficers, useUpdateTaskStatus } from '@workspace/api-client-react';

const createTaskSchema = z.object({
  title: z.string().min(3, 'العنوان قصير جدًا'),
  body: z.string().min(10, 'المحتوى قصير جدًا'),
  dateTime: z.date({ required_error: 'التاريخ والوقت مطلوبان' }),
  assignedToId: z.string().nullable(),
  type: z.nativeEnum(TASKS_TABS),
});

type CreateTaskValues = z.infer<typeof createTaskSchema>;

interface SecurityTaskFormModalProps {
  opened: boolean;
  onClose: () => void;
  security_Id: number;
  taskToEdit?: Task | null;
}

export default function Security_Task_Form_Modal({
  opened,
  onClose,
  security_Id,
  taskToEdit,
}: SecurityTaskFormModalProps) {
  const queryClient = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const officersQuery = useListSecurityOfficers();

  const form = useForm<CreateTaskValues>({
    initialValues: {
      title: '',
      body: '',
      dateTime: new Date(),
      assignedToId: null,
      type: TASKS_TABS.COMPLETED_TASKS,
    },
    validate: zodResolver(createTaskSchema),
  });

  useEffect(() => {
    if (taskToEdit) {
      form.setValues({
        title: taskToEdit.title,
        body: taskToEdit.body,
        dateTime: new Date(taskToEdit.dateTime),
        assignedToId: taskToEdit.assignedToId ?? null,
        type: taskToEdit.type,
      });
    }
  }, [taskToEdit, opened]);

  const mutationOptions = {
    onSuccess: () => {
      notifications.show({
        title: 'نجاح',
        message: taskToEdit ? 'تم تحديث المهمة' : 'تم إنشاء المهمة',
        color: 'grape',
        position: 'top-left',
        withBorder: true,
      });

      form.reset();
      setIdempotencyKey(crypto.randomUUID());
      onClose();
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    },
    onError: (err: any) => {
      const conflict = err?.status === 409;
      if (conflict) queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      notifications.show({
        title: conflict ? 'تعارض في التحديث' : 'خطأ',
        message: conflict ? 'تم تعديل المهمة من جهاز آخر. حُدّثت القائمة، راجع البيانات وحاول مجدداً.' : err?.message || 'فشل في العملية',
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
    },
  };
  const createMutation = useCreateSyncTask({
    mutation: mutationOptions,
    request: { headers: { 'Idempotency-Key': idempotencyKey } },
  });
  const updateMutation = useUpdateTaskStatus({ mutation: mutationOptions });
  const taskMutation = taskToEdit ? updateMutation : createMutation;

  const handleSubmit = (values: CreateTaskValues) => {
    if (taskToEdit?.apiId && taskToEdit.version !== undefined) {
      updateMutation.mutate({
        taskId: taskToEdit.apiId,
        data: {
          title: values.title,
          description: values.body,
          location: 'المخيم',
          priority: TaskPriority.MEDIUM,
          dueAt: values.dateTime.toISOString(),
          assignedToId: values.assignedToId,
          status: values.type === TASKS_TABS.COMPLETED_TASKS ? TaskStatus.COMPLETED : TaskStatus.PENDING,
          expectedVersion: taskToEdit.version,
        },
      });
    } else {
      createMutation.mutate({
        data: {
          title: values.title,
          description: values.body,
          location: 'المخيم',
          priority: TaskPriority.MEDIUM,
          dueAt: values.dateTime.toISOString(),
          assignedToId: values.assignedToId,
        },
      });
    }
  };

  const securityOptions = (officersQuery.data ?? []).map((officer) => ({
    value: officer.id,
    label: officer.name,
  }));

  return (
    <Modal
      data-click='action'
      opened={opened}
      onClose={() => {
        form.reset();
        onClose();
      }}
      title={
        <Text fz={18} fw={600} ta='center' className='!text-primary'>
          {taskToEdit ? 'تعديل المهمة' : 'إنشاء مهمة أمنية جديدة'}
        </Text>
      }
      centered
      overlayProps={{ blur: 3 }}
      classNames={{ title: '!w-full' }}
      radius='md'
      size='lg'
      pos='relative'
      withCloseButton
      onClick={(e) => e.stopPropagation()} // ← Add this line
    >
      <LoadingOverlay
        visible={taskMutation.isPending}
        zIndex={49}
        overlayProps={{ radius: 'sm', blur: 0.3 }}
      />

      <form onSubmit={form.onSubmit(handleSubmit)} data-click='action'>
        <Stack gap={20}>
          <TextInput
            data-testid='task-form-title'
            label={labelWithIcon(FileText, 'عنوان المهمة')}
            placeholder='أدخل العنوان'
            size='sm'
            radius='md'
            {...form.getInputProps('title')}
            classNames={{
              input: 'placeholder:!text-sm !text-primary !font-normal',
            }}
          />

          <Textarea
            data-testid='task-form-description'
            label={labelWithIcon(ClipboardList, 'تفاصيل المهمة')}
            placeholder='اكتب التفاصيل...'
            size='sm'
            radius='md'
            autosize
            minRows={4}
            {...form.getInputProps('body')}
            classNames={{
              input: 'placeholder:!text-sm !text-primary !font-normal',
            }}
          />

          <DateTimePicker
            label={labelWithIcon(Clock4, 'التاريخ والوقت')}
            placeholder='اختر التاريخ والوقت'
            withSeconds={false}
            valueFormat='DD/MM/YYYY - hh:mm A'
            size='sm'
            radius='md'
            value={form.values.dateTime}
            onChange={(value) =>
              form.setFieldValue('dateTime', value ? new Date(value) : form.values.dateTime)
            }
            error={form.errors.dateTime}
            classNames={{
              input: 'placeholder:!text-sm !text-primary !font-normal',
            }}
          />

          <Select
            data-testid='task-form-assignee'
            label={labelWithIcon(UserCheck, 'عناصر الأمن')}
            placeholder='اختر عنصر الأمن (اختياري)'
            data={securityOptions}
            clearable
            searchable
            size='sm'
            radius='md'
            nothingFoundMessage='لا توجد نتائج'
            {...form.getInputProps('assignedToId')}
            classNames={{
              input: 'placeholder:!text-sm !text-primary !font-normal',
            }}
            disabled={officersQuery.isLoading}
          />

          <Select
            label={labelWithIcon(ShieldAlert, 'نوع المهمة')}
            placeholder='اختر نوع المهمة'
            size='sm'
            radius='md'
            data={[
              { value: TASKS_TABS.UPCOMING_TASKS, label: 'مهمة جارية' },
              { value: TASKS_TABS.COMPLETED_TASKS, label: 'مهمة مكتملة' },
            ]}
            {...form.getInputProps('type')}
            classNames={{
              input: 'placeholder:!text-sm !text-primary !font-normal',
            }}
          />
        </Stack>

        <Divider my='md' />

        <Group justify='flex-end' mt='md'>
          <Button
            data-testid='task-form-submit'
            variant='outline'
            color='red'
            size='sm'
            radius='md'
            rightSection={<X size={14} />}
            onClick={() => {
              onClose();
              form.reset();
            }}
            disabled={taskMutation.isPending}
          >
            إلغاء
          </Button>

          <Button
            data-click='action'
            size='sm'
            radius='md'
            type='submit'
            rightSection={<Send size={16} />}
            className='!bg-primary shadow-md text-white'
            disabled={!form.isValid() || taskMutation.isPending}
          >
            {taskToEdit ? 'تعديل' : 'إنشاء'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

function labelWithIcon(Icon: React.ElementType, text: string) {
  return (
    <Group align='center' gap={8}>
      <ThemeIcon variant='light' size='sm' className='!rounded-full'>
        <Icon size={16} />
      </ThemeIcon>
      <Text fz={16} fw={500}>
        {text}
      </Text>
    </Group>
  );
}
