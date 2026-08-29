'use client';
import type { Aid } from '@/@types/actors/manager/aid-management/add-aid-management.types';
import useAuth from '@/hooks/useAuth';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { getListAidsQueryKey, useArchiveAid } from '@workspace/api-client-react';

interface CommonAidDeleteModalProps {
  aid: Aid;
  actor_Id: number;
  opened: boolean;
  close: () => void;
}

export default function Common_Aid_Delete_Modal({
  aid,
  actor_Id,
  opened,
  close,
}: CommonAidDeleteModalProps) {
  const { user, isManager } = useAuth();
  const queryClient = useQueryClient();

  const deleteMutation = useArchiveAid({ mutation: {
    onSuccess: () => {
        notifications.show({
          title: 'تمت العملية بنجاح',
          message: 'تمت أرشفة المساعدة',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        queryClient.invalidateQueries({ queryKey: getListAidsQueryKey() });
        close();
    },
    onError: (error: any) => {
      const conflict = error?.status === 409;
      if (conflict) queryClient.invalidateQueries({ queryKey: getListAidsQueryKey() });
      const errorMessage = conflict ? 'تم تعديل المساعدة من جهاز آخر. حُدّثت القائمة، راجع البيانات وحاول مجدداً.' : error?.message || 'فشل في الأرشفة';
      notifications.show({
        title: 'خطأ',
        message: errorMessage,
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
    },
  }});

  const handleClick = () => {
    if ((isManager || user) && aid.apiId && aid.version !== undefined) {
      deleteMutation.mutate({
        aidId: aid.apiId,
        data: { expectedVersion: aid.version },
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => close()}
      title={
        <Text fz={18} fw={600} ta='center' className='!text-red-500'>
          تأكيد الحذف
        </Text>
      }
      classNames={{
        title: '!w-full',
      }}
      centered
    >
      <Stack>
        <Text fz={16} fw={500}>
           هل أنت متأكد من أرشفة هذه المساعدة؟ هذا الإجراء لا يمكن التراجع عنه.
        </Text>

        <Group justify='flex-end'>
          <Button
            data-testid={`aid-archive-cancel-${aid.apiId}`}
            size='sm'
            type='button'
            variant='outline'
            onClick={close}
            fw={600}
            className='!shadow-md !border-primary !text-primary'
          >
            إلغاء
          </Button>
          <Button
            data-testid={`aid-archive-confirm-${aid.apiId}`}
            size='sm'
            type='button'
            className='!bg-red-500 !shadow-md'
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
