'use client';

import { ActionIcon, Button, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';
import { Trash2 } from 'lucide-react';
import { useDisclosure } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { commonActionResponse } from '@/@types/common/action/commonActionResponse.type';
import { UserRank, UserType } from '@/constants/userTypes';
import { getListComplaintsQueryKey, useArchiveSyncComplaint } from '@workspace/api-client-react';

interface CommonDeleteComplaintProps {
  complaintId: string;
  version: number;
  actor_Id: number;
  role: UserRank | UserType;
}

export default function Common_Delete_Complaint({
  complaintId,
  version,
  actor_Id,
  role,
}: CommonDeleteComplaintProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();

  const deleteMutation = useArchiveSyncComplaint({ mutation: {
    onSuccess: () => {
        notifications.show({
          title: 'تم الحذف',
          message: 'تمت أرشفة الشكوى',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        close();
    },
    onError: (error: any) => {
      const conflict = error?.status === 409;
      if (conflict) queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      notifications.show({
        title: conflict ? 'تعارض في التحديث' : 'خطأ',
        message: conflict ? 'تم تعديل الشكوى من جهاز آخر. حُدّثت القائمة، راجع البيانات وحاول مجدداً.' : error?.message || 'فشل في الأرشفة',
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
    },
  }});

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    deleteMutation.mutate({ complaintId, data: { expectedVersion: version } });
  };

  return (
    <>
      <ActionIcon
        data-testid={`complaint-archive-open-${complaintId}`}
        data-click='delete'
        variant='subtle'
        color='red'
        className='!rounded-full'
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          open();
        }}
        aria-label='حذف الشكوى'
      >
        <Trash2 size={18} />
      </ActionIcon>

      <Modal
        data-click='delete'
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
            هل أنت متأكد من حذف هذه الشكوى؟ لا يمكن التراجع عن هذا الإجراء.
          </Text>

          <Group justify='flex-end'>
            <Button
              data-testid={`complaint-archive-cancel-${complaintId}`}
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
              data-testid={`complaint-archive-confirm-${complaintId}`}
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
    </>
  );
}
