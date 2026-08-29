'use client';

import {
  Modal,
  Stack,
  Group,
  Text,
  Paper,
  ThemeIcon,
  Textarea,
  TextInput,
  Select,
  Button,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MessageSquareReply, UserCircle } from 'lucide-react';
import { parseAsStringEnum, useQueryStates } from 'nuqs';
import { cn } from '@/utils/cn';
import { Complaint } from '@/@types/actors/general/Complaints/ComplaintsResponse.type';
import { USER_RANK, USER_RANK_LABELS, USER_TYPE, UserRank, UserType } from '@/constants/userTypes';
import { z } from 'zod';
import useAuth from '@/hooks/useAuth';
import { COMPLAINTS_TABS } from '@/@types/actors/common-types/index.type';
import { ComplaintStatus, getListComplaintsQueryKey, useUpdateComplaintStatus } from '@workspace/api-client-react';

const complaintSchema = z.object({
  title: z.string().min(2, 'الرجاء إدخال العنوان'),
  body: z.string().min(1, 'الرجاء إدخال التفاصيل'),
  reply: z.string(),
  status: z.nativeEnum(ComplaintStatus),
});

type complaintType = z.infer<typeof complaintSchema>;

interface CommonComplaintModalProps {
  complaint: Complaint;
  actor_Id: number;
  role: UserType | UserRank;
  opened: boolean;
  close: () => void;
}

export default function Common_Complaint_Modal({
  complaint,
  actor_Id,
  role,
  opened,
  close,
}: CommonComplaintModalProps) {
  const { user } = useAuth();

  const [query] = useQueryStates({
    'complaints-tab': parseAsStringEnum(Object.values(COMPLAINTS_TABS)).withDefault(
      COMPLAINTS_TABS.SENT_COMPLAINTS
    ),
  });

  const form = useForm<complaintType>({
    initialValues: {
      title: complaint.title, body: complaint.body, reply: '',
      status: Object.values(ComplaintStatus).includes(complaint.status as ComplaintStatus)
        ? complaint.status as ComplaintStatus
        : complaint.status === 'READ' ? ComplaintStatus.RESOLVED : ComplaintStatus.OPEN,
    },
    validate: zodResolver(complaintSchema),
  });

  const queryClient = useQueryClient();
  const replyMutation = useUpdateComplaintStatus({
    mutation: {
      onSuccess: () => {
        notifications.show({
          title: 'تم الإرسال',
          message: 'تم تحديث الشكوى',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        close();
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      },
    onError: (error: any) => {
      const conflict = error?.status === 409;
      if (conflict) queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      notifications.show({
        title: conflict ? 'تعارض في التحديث' : 'خطأ',
        message: conflict ? 'تم تعديل الشكوى من جهاز آخر. حُدّثت القائمة، راجع البيانات وحاول مجدداً.' : error?.message || 'فشل في تحديث الشكوى',
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
      },
    },
  });

  const handleSubmit = (values: complaintType) => {
    if (!complaint.apiId || complaint.version === undefined) return;
    replyMutation.mutate({ complaintId: complaint.apiId, data: {
      subject: values.title,
      description: values.body,
      ...(values.reply.trim() ? { reply: values.reply.trim() } : {}),
      status: values.status,
      expectedVersion: complaint.version,
    }});
  };

  const isReceived = query['complaints-tab'] === COMPLAINTS_TABS.RECEIVED_COMPLAINTS;
  const isSent = query['complaints-tab'] === COMPLAINTS_TABS.SENT_COMPLAINTS;

  const isReply = user?.role === USER_TYPE.MANAGER || user?.role === USER_TYPE.DELEGATE;

  return (
    <Modal
      opened={opened}
      onClose={close}
      size='lg'
      centered
      radius='md'
      overlayProps={{ blur: 3 }}
      withCloseButton={false}
      title={
        <Text fz={16} fw={600} ta='center'>
          {complaint.title}
        </Text>
      }
      transitionProps={{ transition: 'fade', duration: 200 }}
      classNames={{ title: '!w-full' }}
    >
      <Stack>
        <Group>
          <Group gap={5}>
            <ThemeIcon size='sm' variant='light' color='green'>
              <UserCircle size={16} />
            </ThemeIcon>
            <Text size='sm' c='dimmed'>
              {(() => {
                const isOwner = user?.id === actor_Id && user?.role === role;
                // REFACTOR: add user profile link
                if (role === USER_TYPE.DISPLACED) {
                  return (
                    <>
                      إلى: {complaint.receiver.name} ({USER_RANK_LABELS[complaint.receiver.role]})
                    </>
                  );
                }

                if (role === USER_TYPE.MANAGER) {
                  return (
                    <>
                      من: {complaint.sender.name} ({USER_RANK_LABELS[complaint.sender.role]})
                    </>
                  );
                }

                if (
                  (role === USER_TYPE.DELEGATE || role === USER_TYPE.SECURITY) &&
                  query['complaints-tab'] === COMPLAINTS_TABS.RECEIVED_COMPLAINTS
                ) {
                  return (
                    <>
                      من: {complaint.sender.name} ({USER_RANK_LABELS[complaint.sender.role]})
                    </>
                  );
                }

                if (
                  (role === USER_TYPE.DELEGATE || role === USER_TYPE.SECURITY) &&
                  query['complaints-tab'] === COMPLAINTS_TABS.SENT_COMPLAINTS
                ) {
                  return (
                    <>
                      إلى: {complaint.receiver.name} ({USER_RANK_LABELS[complaint.receiver.role]})
                    </>
                  );
                }

                // fallback if no specific role match
                if (isReceived) {
                  return (
                    <>
                      من: {complaint.sender.name} ({USER_RANK_LABELS[complaint.sender.role]})
                    </>
                  );
                }

                if (isSent) {
                  return (
                    <>
                      إلى: {complaint.receiver.name} ({USER_RANK_LABELS[complaint.receiver.role]})
                    </>
                  );
                }

                return null;
              })()}
            </Text>
          </Group>

          <Group gap={5}>
            <ThemeIcon size='sm' variant='light' color='yellow'>
              <Calendar size={16} />
            </ThemeIcon>
            <Text size='sm' c='dimmed'>
              {/* {complaint.date} - {complaint.time} */}
              {complaint.date}
            </Text>
          </Group>
        </Group>

        <Paper p='xs' radius='md' withBorder shadow='xs' bg='gray.0'>
          <Group wrap='nowrap' align='flex-start' gap={6}>
            <ThemeIcon size='sm' variant='light' color='blue'>
              <MessageSquareReply size={16} />
            </ThemeIcon>
            <Text size='sm' fw={500}>
              {complaint.body}
            </Text>
          </Group>
        </Paper>

        {isReply && (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput data-testid='complaint-edit-title' label='العنوان' {...form.getInputProps('title')} />
              <Textarea data-testid='complaint-edit-description' label='تفاصيل الشكوى' minRows={3} {...form.getInputProps('body')} />
              <Select
                data-testid='complaint-edit-status'
                label='حالة الشكوى'
                data={[
                  { value: ComplaintStatus.OPEN, label: 'مفتوحة' },
                  { value: ComplaintStatus.IN_REVIEW, label: 'قيد المراجعة' },
                  { value: ComplaintStatus.RESOLVED, label: 'تم الحل' },
                  { value: ComplaintStatus.REJECTED, label: 'مرفوضة' },
                ]}
                {...form.getInputProps('status')}
              />
              <Textarea
                data-testid='complaint-reply'
                size='sm'
                label={
                  <Text size='sm' fw={500} className='!text-primary'>
                    الرد:
                  </Text>
                }
                placeholder='رداً على الشكوى...'
                minRows={3}
                autosize
                {...form.getInputProps('reply')}
                classNames={{
                  input: 'placeholder:!text-sm !text-primary !font-normal',
                }}
              />

              <Group justify='flex-end'>
                <Button
                  data-testid='complaint-edit-cancel'
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    form.reset();
                    close();
                  }}
                  className='!border-primary !text-primary'
                >
                  إلغاء
                </Button>
                <Button
                  data-testid='complaint-edit-submit'
                  size='sm'
                  type='submit'
                  className={cn(
                    'shadow-md',
                     '!bg-primary'
                  )}
                  loading={replyMutation.isPending}
                >
                   حفظ وإرسال الرد
                </Button>
              </Group>
            </Stack>
          </form>
        )}

        {!isReply && (
          <Group justify='flex-end'>
            <Button
              size='sm'
              variant='outline'
              onClick={close}
              className='!border-red-500 !text-red-500'
            >
              إغلاق
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
