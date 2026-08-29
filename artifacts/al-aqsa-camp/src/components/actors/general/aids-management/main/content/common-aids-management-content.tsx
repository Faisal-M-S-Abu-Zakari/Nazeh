'use client';

import { useState } from 'react';
import { Box, Center, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { parseAsInteger, parseAsStringEnum, useQueryStates } from 'nuqs';
import { AidsResponse } from '@/@types/actors/manager/aid-management/add-aid-management.types';
import { aidsManagementFilterFormType } from '@/validation/actor/manager/aids-management/aids-management-filters-schema';
import { USER_RANK, USER_TYPE, UserRank, UserType } from '@/constants/userTypes';
import Common_Aids_Management_Filters from './common-aids-management-filters';
import Common_Aids_List from './card/common-aids-list';
import { TYPE_GROUP_AIDS } from '@/@types/actors/common-types/index.type';
import { MessageCircleWarning } from 'lucide-react';
import { AidType, getListAidsQueryKey, useListAids } from '@workspace/api-client-react';
import { DISTRIBUTION_MECHANISM, DISTRIBUTION_METHOD, QUANTITY_AVAILABILITY, TYPE_AIDS } from '@/@types/actors/common-types/index.type';

interface CommonAidsManagementContentProps {
  actor_Id: number;
  role: Exclude<
    (typeof USER_RANK)[UserRank],
    typeof USER_RANK.SECURITY_OFFICER | typeof USER_TYPE.DISPLACED | typeof USER_TYPE.SECURITY
  >;
}

export default function Common_Aids_Management_Content({
  actor_Id,
  role,
}: CommonAidsManagementContentProps) {
  const [query] = useQueryStates({
    'aids-tab': parseAsStringEnum<TYPE_GROUP_AIDS>(Object.values(TYPE_GROUP_AIDS)).withDefault(
      TYPE_GROUP_AIDS.ONGOING_AIDS
    ),
    'aids-page': parseAsInteger.withDefault(1),
  });

  const [localFilters, setLocalFilters] = useState<aidsManagementFilterFormType>({
    type: null,
    date_range: [null, null],
    recipients_range: [null, null],
  });

  const limit = 10;

  const aidsQuery = useListAids({
    query: { queryKey: getListAidsQueryKey(), refetchInterval: 20_000 },
  });
  const typeMap: Record<string, TYPE_AIDS> = {
    [AidType.FOOD]: TYPE_AIDS.FOOD_AID,
    [AidType.WATER]: TYPE_AIDS.OTHER_AID,
    [AidType.MEDICAL]: TYPE_AIDS.MEDICAL_AID,
    [AidType.SHELTER]: TYPE_AIDS.OTHER_AID,
    [AidType.HYGIENE]: TYPE_AIDS.CLEANING_AID,
    [AidType.OTHER]: TYPE_AIDS.OTHER_AID,
  };
  const now = Date.now();
  const mapped = (aidsQuery.data ?? []).map((aid, index) => {
    const delivery = new Date(aid.distributionDate);
    const group = delivery.getTime() < now ? TYPE_GROUP_AIDS.PREVIOUS_AIDS
      : delivery.getTime() > now + 86_400_000 ? TYPE_GROUP_AIDS.COMING_AIDS
      : TYPE_GROUP_AIDS.ONGOING_AIDS;
    return {
      id: index + 1,
      aid_name: aid.title,
      aid_type: typeMap[aid.type],
      aid_content: `${aid.quantity} ${aid.unit}`,
      delivery_date: delivery,
      delivery_location: aid.location,
      security_required: false,
      quantity_availability: QUANTITY_AVAILABILITY.LIMITED,
      existing_quantity: aid.quantity,
      displaced_single_portion: 1,
      selected_categories: [],
      distribution_method: DISTRIBUTION_METHOD.EQUAL,
      distribution_mechanism: DISTRIBUTION_MECHANISM.DISPLACED_FAMILIES,
      additional_notes: aid.notes ?? '',
      selected_displaced_Ids: [],
      received_displaceds: [],
      is_completed: group === TYPE_GROUP_AIDS.PREVIOUS_AIDS,
      aid_status: group,
    } as AidsResponse['aids'][number];
  }).filter((aid) => aid.aid_status === query['aids-tab']);
  const start = (query['aids-page'] - 1) * limit;
  const AidsData: AidsResponse = {
    status: 200,
    aids: mapped.slice(start, start + limit),
    pagination: { page: query['aids-page'], limit, total_items: mapped.length, total_pages: Math.max(1, Math.ceil(mapped.length / limit)) },
  };
  const isLoading = aidsQuery.isLoading;
  const error = aidsQuery.error;

  const hasError = Boolean(error);

  return (
    <Stack w={'100%'}>
      <Common_Aids_Management_Filters
        setLocalFilters={setLocalFilters}
        aidsNum={AidsData?.pagination.total_items ?? 0}
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
              {error?.message || 'حدث خطأ أثناء جلب المساعدات. تحقق من الاتصال ثم أعد المحاولة.'}
            </Text>
          </Box>
        </Paper>
      ) : (
        <Common_Aids_List
          data={AidsData?.aids || []}
          total_pages={AidsData?.pagination.total_pages || 1}
          isLoading={isLoading}
          actor_Id={actor_Id}
          role={role}
        />
      )}
    </Stack>
  );
}
