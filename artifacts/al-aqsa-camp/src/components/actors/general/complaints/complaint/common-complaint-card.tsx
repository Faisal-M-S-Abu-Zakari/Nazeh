'use client';

import { Box, Button, Card, Flex, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { cn } from '@/utils/cn';
import { Complaint } from '@/@types/actors/general/Complaints/ComplaintsResponse.type';
import { Image } from '@/lib/nextjs-mocks';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { MAN } from '@/assets/actor';
import { parseAsStringEnum, useQueryStates } from 'nuqs';
import { USER_RANK, USER_RANK_LABELS, USER_TYPE, UserRank, UserType } from '@/constants/userTypes';
import Common_Delete_Complaint from './common-delete-complaint';
import Common_Complaint_Modal from './common-complaint-modal';
import useAuth from '@/hooks/useAuth';
import { COMPLAINTS_STATUS, COMPLAINTS_TABS } from '@/@types/actors/common-types/index.type';
import { Calendar, User, FileText, MailWarning, CheckCircle2, Clock } from 'lucide-react';
import { ComplaintStatus, getListComplaintsQueryKey, useUpdateComplaintStatus } from '@workspace/api-client-react';

const complaintStatusLabels: Record<ComplaintStatus, string> = {
  [ComplaintStatus.OPEN]: 'مفتوحة',
  [ComplaintStatus.IN_REVIEW]: 'قيد المراجعة',
  [ComplaintStatus.RESOLVED]: 'تم الحل',
  [ComplaintStatus.REJECTED]: 'مرفوضة',
};

interface CommonComplaintCardProps {
  complaint: Complaint;
  actor_Id: number;
  role: UserType | UserRank;
}

export default function Common_Complaint_Card({
  complaint,
  actor_Id,
  role,
}: CommonComplaintCardProps) {
  const [query] = useQueryStates({
    'complaints-tab': parseAsStringEnum<COMPLAINTS_TABS>(
      Object.values(COMPLAINTS_TABS)
    ).withDefault(COMPLAINTS_TABS.SENT_COMPLAINTS),
  });

  const { user, isManager, isDelegate } = useAuth();
  const isOwner = user?.id === actor_Id && user?.role === role;

  const [opened, { open, close }] = useDisclosure(false);
  const apiStatus = Object.values(ComplaintStatus).includes(complaint.status as ComplaintStatus)
    ? complaint.status as ComplaintStatus
    : complaint.status === COMPLAINTS_STATUS.READ ? ComplaintStatus.RESOLVED : ComplaintStatus.OPEN;
  const isClosed = apiStatus === ComplaintStatus.RESOLVED || apiStatus === ComplaintStatus.REJECTED;
  const queryClient = useQueryClient();

  const changeStatusMutation = useUpdateComplaintStatus({
    mutation: {
      onSuccess: () => {
        notifications.show({
          title: 'تمت العملية بنجاح',
          message: 'تم تحديث حالة الشكوى',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      },
      onError: (error: any) => {
        const conflict = error?.status === 409;
        if (conflict) {
          queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        }
        notifications.show({
          title: conflict ? 'تم تحديث الشكوى من جهاز آخر' : 'خطأ',
          message: conflict
            ? 'قام أحد أفراد الطاقم بتغيير هذه الشكوى. تم تحديث القائمة، يرجى مراجعة الحالة ثم المحاولة.'
            : error?.message || 'فشل في تغيير حالة الشكوى',
          color: 'red',
          position: 'top-left',
          withBorder: true,
        });
      },
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    const path = e.nativeEvent.composedPath() as HTMLElement[];
    const clickedOnDelete = path.some((el) => {
      const attr = (el as HTMLElement)?.getAttribute?.('data-click');
      const classes = (el as HTMLElement)?.classList?.toString() || '';
      return attr === 'delete' || classes.includes('delete');
    });

    if (!clickedOnDelete) {
      open();
    }
  };

  return (
    <>
      <Card
        data-testid={`complaint-${complaint.apiId ?? complaint.id}`}
        key={complaint.id}
        p='md'
        radius='lg'
        shadow='sm'
        className={cn(
          'hover:shadow-md !border !border-gray-300 transition-all cursor-pointer',
          isClosed ? '!bg-gray-50' : '!bg-red-50'
        )}
        onClick={handleClick}
      >
        <Group align='flex-start' gap='md'>
          <Box
            className='bg-primary border border-gray-300 rounded-full overflow-hidden'
            w={60}
            h={60}
          >
            <Image src={MAN} alt='Profile' width={60} height={60} className='object-cover' />
          </Box>

          <Stack flex={1} gap={6}>
            <Flex justify='space-between' align='center'>
              <Group gap={6}>
                <ThemeIcon size='sm' variant='light' color='blue'>
                  <Calendar size={14} />
                </ThemeIcon>
                <Text size='xs' c='dimmed'>
                  {complaint.date}
                </Text>
              </Group>
              <Group gap={6}>
                <ThemeIcon
                  size='sm'
                  variant='light'
                  color={isClosed ? 'green' : 'orange'}
                >
                  {isClosed ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Clock size={14} />
                  )}
                </ThemeIcon>
                <Text size='xs' c='dimmed'>
                  {complaintStatusLabels[apiStatus]}
                </Text>
              </Group>
            </Flex>

            <Group gap={6}>
              <ThemeIcon size='sm' variant='light' color='violet'>
                <User size={14} />
              </ThemeIcon>
              <Text fz={15} fw={600} c='dark'>
                {query['complaints-tab'] == COMPLAINTS_TABS.RECEIVED_COMPLAINTS &&
                  `من ${USER_RANK_LABELS[complaint.sender.role]}: ${complaint.sender.name}`}
                {query['complaints-tab'] == COMPLAINTS_TABS.SENT_COMPLAINTS &&
                  `إلى ${USER_RANK_LABELS[complaint.receiver.role]}: ${complaint.receiver.name}`}
              </Text>
            </Group>
            {(isManager || isDelegate) && complaint.apiId && complaint.version !== undefined && (
              <Group data-click='delete'>
                <Button
                  data-testid={`complaint-status-${complaint.apiId}`}
                  size='xs'
                  variant='light'
                  loading={changeStatusMutation.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    changeStatusMutation.mutate({
                      complaintId: complaint.apiId!,
                      data: {
                        status: isClosed ? ComplaintStatus.IN_REVIEW : ComplaintStatus.RESOLVED,
                        expectedVersion: complaint.version!,
                      },
                    });
                  }}
                >
                  {isClosed ? 'إعادة للمراجعة' : 'تحديد كمحلولة'}
                </Button>
                <Common_Delete_Complaint
                  complaintId={complaint.apiId}
                  version={complaint.version}
                  actor_Id={actor_Id}
                  role={role}
                />
              </Group>
            )}

            <Group gap={6}>
              <ThemeIcon size='sm' variant='light' color='grape'>
                <FileText size={14} />
              </ThemeIcon>
              <Text size='sm' fw={600}>
                العنوان: {complaint.title}
              </Text>
            </Group>
          </Stack>

        </Group>
      </Card>

      <Common_Complaint_Modal
        complaint={complaint}
        actor_Id={actor_Id}
        role={role}
        opened={opened}
        close={close}
      />
    </>
  );
}
