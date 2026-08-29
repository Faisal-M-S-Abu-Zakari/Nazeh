'use client';
import type { Displaced } from '@/@types/actors/general/displaceds/displacesResponse.type';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { getListPeopleQueryKey, useArchivePerson } from '@workspace/api-client-react';

interface DeleteModalProps {
  people: Displaced[];
  opened: boolean;
  close: () => void;
}

export default function Delete_Displaced_Modal({ people, opened, close }: DeleteModalProps) {
  const queryClient = useQueryClient();
  const deleteMutation = useArchivePerson({
    mutation: {
      onSuccess: () => {
        notifications.show({
          title: 'تمت العملية بنجاح',
          message: 'تمت أرشفة السجل',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        queryClient.invalidateQueries({ queryKey: getListPeopleQueryKey() });
        close();
      },
    onError: (error: any) => {
      const conflict = error?.status === 409;
      if (conflict) queryClient.invalidateQueries({ queryKey: getListPeopleQueryKey() });
      const errorMessage = conflict ? 'تم تعديل السجل من جهاز آخر. حُدّثت القائمة، راجع البيانات وحاول مجدداً.' : error?.message || 'فشل في الأرشفة';
      notifications.show({
        title: 'خطأ',
        message: errorMessage,
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
      },
    },
  });

  const handleClick = () => {
    const person = people[0];
    if (person?.apiId && person.version !== undefined) deleteMutation.mutate({ personId: person.apiId, data: { expectedVersion: person.version } });
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
        {people.length === 1 && (
          <Text fz={16} fw={500}>
             هل أنت متأكد من أرشفة هذا النازح؟ هذا الإجراء لا يمكن التراجع عنه.
          </Text>
        )}
        {people.length > 1 && (
          <Text fz={16} fw={500}>
            هل أنت متأكد من حذف هؤلاء النازحين؟ هذا الإجراء لا يمكن التراجع عنه.
          </Text>
        )}
        <Group justify='flex-end'>
          <Button
            data-testid='person-archive-cancel'
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
            data-testid='person-archive-confirm'
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
