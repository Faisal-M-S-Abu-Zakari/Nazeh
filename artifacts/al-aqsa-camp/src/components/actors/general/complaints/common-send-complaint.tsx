'use client';

import { USER_RANK, USER_RANK_LABELS, USER_TYPE, UserRank, UserType } from '@/constants/userTypes';
import useAuth from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import {
  commonSendComplaintFormSchema,
  commonSendComplaintFormValues,
} from '@/validation/actor/general/complaints/sendComplaintFormSchema';
import {
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquareDiff, Send, X } from 'lucide-react';
import { getListComplaintsQueryKey, useCreateSyncComplaint } from '@workspace/api-client-react';

const ALLOWED_RECEPTIONS: Record<UserRank, UserRank[]> = {
  ADMIN: [USER_TYPE.DELEGATE],
  DISPLACED: [USER_TYPE.MANAGER, USER_TYPE.DELEGATE, USER_RANK.SECURITY_OFFICER],
  DELEGATE: [USER_TYPE.MANAGER, USER_RANK.SECURITY_OFFICER],
  SECURITY: [USER_TYPE.MANAGER, USER_RANK.SECURITY_OFFICER],
  SECURITY_MEMBER: [USER_TYPE.MANAGER, USER_RANK.SECURITY_OFFICER],
  SECURITY_OFFICER: [USER_TYPE.MANAGER],
  MANAGER: [USER_TYPE.DELEGATE],
};

export default function Common_Send_Complaint() {
  const { user, isManager, isDelegate } = useAuth();
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const allowedReceptions = (user?.role && ALLOWED_RECEPTIONS[user.role as UserType]) || [];

  const dynamicReceptionOptions = allowedReceptions.map((value) => ({
    value: value as UserRank,
    label: USER_RANK_LABELS[value as UserRank],
  }));

  const formSchema = commonSendComplaintFormSchema.refine(
    (data) => allowedReceptions.includes(data.reception),
    {
      path: ['reception'],
      message: 'جهة الاستقبال غير صالحة لهذا الدور',
    }
  );

  const form = useForm<commonSendComplaintFormValues>({
    initialValues: {
      reception: '' as any,
      title: '',
      content: '',
    },
    validate: zodResolver(formSchema),
  });

  const sendCommonComplaintMutation = useCreateSyncComplaint({
    mutation: {
      onSuccess: () => {
        notifications.show({
          title: 'تمت العملية بنجاح',
          message: 'تم إنشاء الشكوى',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        close();
        form.reset();
        setIdempotencyKey(crypto.randomUUID());
        queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      },
    onError: (error: any) => {
      notifications.show({
        title: 'خطأ',
        message: error?.message || 'فشل في إرسال الشكوى',
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
      },
    },
    request: { headers: { 'Idempotency-Key': idempotencyKey } },
  });

  const handleSubmit = (values: commonSendComplaintFormValues) => {
    if (!user || (!isManager && !isDelegate)) return;
    sendCommonComplaintMutation.mutate({
      data: {
        complainantName: user.name,
        subject: values.title,
        description: values.content,
      },
    });
  };

  const disabled = sendCommonComplaintMutation.isPending || (!isManager && !isDelegate);

  return (
    <>
      <Button
        data-testid='complaint-create-open'
        type='button'
        size='sm'
        radius='md'
        onClick={open}
        rightSection={<MessageSquareDiff size={16} />}
        className='!bg-primary shadow-md font-semibold text-white'
        disabled={disabled}
      >
        تقديم شكوى
      </Button>

      <Modal
        opened={opened}
        onClose={() => {
          close();
          form.reset();
        }}
        title={
          <Text size='lg' fw={600} ta='center' className='text-primary'>
            إرسال شكوى جديدة
          </Text>
        }
        centered
        size='lg'
        radius='md'
        overlayProps={{ blur: 2, backgroundOpacity: 0.55 }}
        classNames={{ title: '!w-full' }}
        pos={'relative'}
      >
        <LoadingOverlay
          visible={sendCommonComplaintMutation.isPending}
          zIndex={49}
          overlayProps={{ radius: 'sm', blur: 0.3 }}
        />
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap='md' mt='xs'>
            <Select
              label='شكوى إلى'
              placeholder='اختر الجهة المستقبلة...'
              data={dynamicReceptionOptions}
              size='sm'
              radius='md'
              withAsterisk
              classNames={{
                input: 'placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('reception')}
              disabled={disabled}
            />

            <TextInput
              label='عنوان الشكوى'
              placeholder='أدخل عنوان الشكوى...'
              size='sm'
              radius='md'
              withAsterisk
              classNames={{
                input: 'placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('title')}
              disabled={disabled}
            />

            <Textarea
              label='محتوى الشكوى'
              placeholder='اكتب تفاصيل الشكوى هنا...'
              autosize
              minRows={4}
              maxRows={8}
              size='sm'
              radius='md'
              withAsterisk
              classNames={{
                input: 'placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('content')}
              disabled={disabled}
            />

            <Group justify='flex-end' mt='xs'>
              <Button
                data-testid='complaint-create-cancel'
                variant='outline'
                color='red'
                size='sm'
                radius='md'
                rightSection={<X size={14} />}
                onClick={() => {
                  close();
                  form.reset();
                }}
                disabled={sendCommonComplaintMutation.isPending}
              >
                إلغاء
              </Button>

              <Button
                data-testid='complaint-create-submit'
                size='sm'
                type='submit'
                radius='md'
                rightSection={<Send size={14} />}
                className={cn(
                  'shadow-lg text-white',
                  !form.isValid() ? '!bg-primary/70' : '!bg-primary'
                )}
                disabled={!form.isValid() || disabled}
              >
                إرسال
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
