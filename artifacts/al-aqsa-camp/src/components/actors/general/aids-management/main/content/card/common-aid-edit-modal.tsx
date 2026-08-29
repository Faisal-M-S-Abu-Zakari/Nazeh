'use client';
import type { Aid } from '@/@types/actors/manager/aid-management/add-aid-management.types';
import { Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { AidType, getListAidsQueryKey, useUpdateSyncAid } from '@workspace/api-client-react';

export default function Common_Aid_Edit_Modal({ aid, opened, close }: { aid: Aid; opened: boolean; close: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm({ initialValues: {
    title: aid.aid_name,
    type: aid.apiType ?? AidType.OTHER,
    quantity: aid.existing_quantity,
    unit: aid.apiUnit ?? 'حصة',
    location: aid.delivery_location || 'المخيم',
    distributionDate: (aid.apiDistributionDate ?? aid.delivery_date?.toISOString() ?? '').slice(0, 10),
    notes: aid.additional_notes,
  }});
  const mutation = useUpdateSyncAid({ mutation: {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAidsQueryKey() });
      notifications.show({ title: 'تمت العملية بنجاح', message: 'تم تحديث المساعدة', color: 'grape' });
      close();
    },
    onError: (error: any) => {
      const conflict = error?.status === 409;
      if (conflict) queryClient.invalidateQueries({ queryKey: getListAidsQueryKey() });
      notifications.show({ title: conflict ? 'تعارض في التحديث' : 'خطأ', message: conflict ? 'تم تعديل المساعدة من جهاز آخر. حُدّثت القائمة، راجع البيانات وحاول مجدداً.' : error?.message || 'فشل التحديث', color: 'red' });
    },
  }});
  return <Modal opened={opened} onClose={close} centered title={<Text fw={600}>تعديل المساعدة</Text>}>
    <form onSubmit={form.onSubmit((values) => {
      if (aid.apiId && aid.version !== undefined) mutation.mutate({
        aidId: aid.apiId, data: { ...values, type: values.type as import('@workspace/api-client-react').AidType, expectedVersion: aid.version },
      });
    })}>
      <Stack>
        <TextInput data-testid='aid-edit-title' label='اسم المساعدة' required {...form.getInputProps('title')} />
        <Select
          data-testid='aid-edit-type'
          label='نوع المساعدة'
          data={[
            { value: AidType.FOOD, label: 'غذاء' },
            { value: AidType.WATER, label: 'مياه' },
            { value: AidType.MEDICAL, label: 'طبية' },
            { value: AidType.SHELTER, label: 'إيواء' },
            { value: AidType.HYGIENE, label: 'نظافة' },
            { value: AidType.OTHER, label: 'أخرى' },
          ]}
          required
          {...form.getInputProps('type')}
        />
        <NumberInput data-testid='aid-edit-quantity' label='الكمية' min={1} required {...form.getInputProps('quantity')} />
        <TextInput data-testid='aid-edit-unit' label='الوحدة' required {...form.getInputProps('unit')} />
        <TextInput data-testid='aid-edit-location' label='الموقع' required {...form.getInputProps('location')} />
        <TextInput data-testid='aid-edit-distribution-date' type='date' label='تاريخ التوزيع' required {...form.getInputProps('distributionDate')} />
        <Textarea data-testid='aid-edit-notes' label='ملاحظات' {...form.getInputProps('notes')} />
        <Group justify='flex-end'><Button data-testid='aid-edit-cancel' variant='outline' onClick={close}>إلغاء</Button><Button data-testid='aid-edit-submit' type='submit' loading={mutation.isPending}>حفظ</Button></Group>
      </Stack>
    </form>
  </Modal>;
}