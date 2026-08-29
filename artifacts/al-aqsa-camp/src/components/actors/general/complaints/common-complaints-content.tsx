'use client';

import { useState } from 'react';
import { Box, Center, Paper, Text, ThemeIcon } from '@mantine/core';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { ComplaintResponse } from '@/@types/actors/general/Complaints/ComplaintsResponse.type';
import { USER_TYPE, UserRank, UserType } from '@/constants/userTypes';
import { CommonComplaintFilterFormValues } from '@/validation/actor/general/complaints/commonComplaintsSchema';
import Common_Complaints_Filters from './common-complaints-filters';
import Common_Complaints_List from './common-complaints-list';
import { COMPLAINTS_STATUS, COMPLAINTS_TABS } from '@/@types/actors/common-types/index.type';
import { MessageCircleWarning } from 'lucide-react';
import { ComplaintStatus, getListComplaintsQueryKey, useListComplaints } from '@workspace/api-client-react';

interface CommonComplaintsContentProps {
  actor_Id: number;
  rank: UserType | UserRank;
}

export default function Common_Complaints_Content({
  actor_Id,
  rank,
}: CommonComplaintsContentProps) {
  const role = rank;

  const defaultTab =
    role == USER_TYPE.DISPLACED
      ? COMPLAINTS_TABS.SENT_COMPLAINTS
      : role == USER_TYPE.MANAGER
      ? COMPLAINTS_TABS.RECEIVED_COMPLAINTS
      : COMPLAINTS_TABS.SENT_COMPLAINTS;

  const [query, setQuery] = useQueryStates({
    'complaints-tab': parseAsStringEnum<COMPLAINTS_TABS>(
      Object.values(COMPLAINTS_TABS)
    ).withDefault(defaultTab),
    // ).withDefault(COMPLAINTS_TABS.SENT_COMPLAINTS),
    'complaints-page': parseAsInteger.withDefault(1),
    search: parseAsString.withDefault(''),
  });

  const [localFilters, setLocalFilters] = useState<CommonComplaintFilterFormValues>({
    status: null,
    date_range: [null, null],
  });

  const limit = 7;

  const complaintsQuery = useListComplaints({
    query: { queryKey: getListComplaintsQueryKey(), enabled: !!actor_Id, refetchInterval: 20_000 },
  });
  const filtered = (complaintsQuery.data ?? [])
    .filter((item) => !query.search || `${item.complainantName} ${item.subject}`.includes(query.search))
    .map((item) => ({
      id: item.id,
      apiId: item.id,
      version: item.version,
      date: new Date(item.createdAt).toLocaleDateString('ar-EG'),
      sender: { id: 0, name: item.complainantName, image: '', role: USER_TYPE.DELEGATE },
      receiver: { id: actor_Id, name: 'إدارة المخيم', image: '', role: USER_TYPE.MANAGER },
      title: item.subject,
      body: item.description,
      status: item.status,
    } as ComplaintResponse['complaints'][number]));
  const start = (query['complaints-page'] - 1) * limit;
  const complaintsData: ComplaintResponse = {
    status: 200,
    complaints: filtered.slice(start, start + limit),
    pagination: { page: query['complaints-page'], limit, total_items: filtered.length, total_pages: Math.max(1, Math.ceil(filtered.length / limit)) },
  };
  const isLoading = complaintsQuery.isLoading;
  const error = complaintsQuery.error;

  if (!actor_Id) {
    return <Text c='red'>لا يمكن تحميل الشكاوى، لم يتم تحديد هوية المستخدم.</Text>;
  }
  const hasError = Boolean(error);

  return (
    <Box dir='rtl' w='100%' p='sm'>
      <Common_Complaints_Filters
        setLocalFilters={setLocalFilters}
        complaintsNum={complaintsData?.pagination.total_items ?? 0}
        actor_Id={actor_Id}
        role={role}
      />

      {hasError ? (
        <Paper p='md' withBorder mt='md' className='!bg-red-100 rounded-md text-center'>
          <Box>
            <Center mb='sm'>
              <ThemeIcon color='red' variant='light' size='lg'>
                <MessageCircleWarning />
              </ThemeIcon>
            </Center>
            <Text c='red' fw={600}>
              {error?.message || 'حدث خطأ أثناء جلب الشكاوى. تحقق من الاتصال ثم أعد المحاولة.'}
            </Text>
          </Box>
        </Paper>
      ) : (
        <Common_Complaints_List
          complaints={complaintsData?.complaints || []}
          total_pages={complaintsData?.pagination.total_pages || 1}
          loading={isLoading}
          actor_Id={actor_Id}
          role={role}
        />
      )}
    </Box>
  );
}
