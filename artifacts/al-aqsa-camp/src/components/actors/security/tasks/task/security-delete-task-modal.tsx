import type { Task } from '@/@types/actors/security/tasks/TasksResponse.type';
import { Button, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { getListTasksQueryKey, useArchiveSyncTask } from '@workspace/api-client-react';

interface SecurityDeleteTaskProps {
  task: Task;
  security_Id: number;
  opened: boolean;
  close: () => void;
}

export default function Security_Delete_Task_Modal({
  task,
  security_Id,
  opened,
  close,
}: SecurityDeleteTaskProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useArchiveSyncTask({ mutation: {
    onSuccess: () => {
        notifications.show({
          title: 'تم الحذف',
          message: 'تمت أرشفة المهمة',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        close();
    },
    onError: (error: any) => {
      const conflict = error?.status === 409;
      if (conflict) queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      notifications.show({
        title: conflict ? 'تعارض في التحديث' : 'خطأ',
        message: conflict ? 'تم تعديل المهمة من جهاز آخر. حُدّثت القائمة، راجع البيانات وحاول مجدداً.' : error?.message || 'فشل في الأرشفة',
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
    },
  }});

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (task.apiId && task.version !== undefined) deleteMutation.mutate({ taskId: task.apiId, data: { expectedVersion: task.version } });
  };

  return (
    <Modal
      data-click='action'
      opened={opened}
      onClose={close}
      size='sm'
      radius='md'
      centered
      overlayProps={{ blur: 3 }}
      title={
        <Group justify='center' align='center' gap='xs'>
          <Text fz={16} fw={600} className='!text-red-600'>
            تأكيد الحذف
          </Text>
          <ThemeIcon color='red' variant='light' size='sm'>
            <Trash2 size={16} />
          </ThemeIcon>
        </Group>
      }
      classNames={{ title: '!w-full' }}
    >
      <Stack>
        <Text fz={16} fw={500} c='gray.7'>
           هل أنت متأكد من أرشفة هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.
        </Text>

        <Group justify='flex-end'>
          <Button
            data-testid={`task-archive-cancel-${task.apiId}`}
            size='sm'
            variant='outline'
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className='!border-primary !text-primary'
          >
            إلغاء
          </Button>

          <Button
            data-testid={`task-archive-confirm-${task.apiId}`}
            size='sm'
            className='!bg-red-600 !text-white'
            loading={deleteMutation.isPending}
            onClick={handleClick}
          >
             أرشفة
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
