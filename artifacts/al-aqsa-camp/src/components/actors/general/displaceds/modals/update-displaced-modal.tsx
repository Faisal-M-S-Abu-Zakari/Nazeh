'use client';

import type { Displaced } from '@/@types/actors/general/displaceds/displacesResponse.type';
import { Button, Group, Modal, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { getListPeopleQueryKey, useUpdatePerson } from '@workspace/api-client-react';
import { useEffect } from 'react';

interface UpdateModalProps {
  person?: Displaced;
  opened: boolean;
  close: () => void;
}

export default function Update_Displaced_Modal({ person, opened, close }: UpdateModalProps) {
  const queryClient = useQueryClient();
  const form = useForm({
    initialValues: { fullName: '', nationalId: '', phone: '', tentNumber: '', familySize: 1 },
  });

  useEffect(() => {
    if (opened && person) form.setValues({
      fullName: person.name,
      nationalId: person.identity,
      phone: person.mobile_number === '—' ? '' : person.mobile_number,
      tentNumber: person.tent,
      familySize: person.family_number,
    });
  }, [opened, person]);

  const updateMutation = useUpdatePerson({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPeopleQueryKey() });
        notifications.show({ title: 'تمت العملية بنجاح', message: 'تم تحديث بيانات النازح', color: 'grape' });
        close();
      },
      onError: (error: any) => {
        const conflict = error?.status === 409;
        if (conflict) queryClient.invalidateQueries({ queryKey: getListPeopleQueryKey() });
        notifications.show({
          title: conflict ? 'تعارض في التحديث' : 'خطأ',
          message: conflict ? 'تم تعديل السجل من جهاز آخر. حُدّثت القائمة، راجع البيانات وحاول مجدداً.' : error?.message || 'فشل في تحديث البيانات',
          color: 'red',
        });
      },
    },
  });

  return (
    <Modal opened={opened} onClose={close} centered title={<Text fw={600}>تعديل بيانات النازح</Text>}>
      <form onSubmit={form.onSubmit((values) => {
        if (person?.apiId && person.version !== undefined) updateMutation.mutate({
          personId: person.apiId,
          data: { ...values, phone: values.phone || null, expectedVersion: person.version },
        });
      })}>
        <Stack>
          <TextInput data-testid='person-edit-name' label='الاسم الكامل' required {...form.getInputProps('fullName')} />
          <TextInput data-testid='person-edit-national-id' label='رقم الهوية' required {...form.getInputProps('nationalId')} />
          <TextInput data-testid='person-edit-phone' label='رقم الجوال' {...form.getInputProps('phone')} />
          <TextInput data-testid='person-edit-tent' label='رقم الخيمة' required {...form.getInputProps('tentNumber')} />
          <NumberInput data-testid='person-edit-family-size' label='عدد أفراد الأسرة' min={1} max={50} {...form.getInputProps('familySize')} />
          <Group justify='flex-end'>
            <Button data-testid='person-edit-cancel' variant='outline' onClick={close}>إلغاء</Button>
            <Button data-testid='person-edit-submit' type='submit' loading={updateMutation.isPending}>حفظ</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}