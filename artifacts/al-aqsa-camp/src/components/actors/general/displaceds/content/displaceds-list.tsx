'use client';

import { Button, Group, Stack, Text } from '@mantine/core';
import { Database, UserPlus } from 'lucide-react';
import { Suspense, useState } from 'react';
import Displaceds_Table from './displaceds-table';
import useAuth from '@/hooks/useAuth';
import { USER_TYPE } from '@/constants/userTypes';
import Displaceds_Filters from './displaceds-filters';
import { useRouter  } from '@/lib/nextjs-mocks';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';
import { displacedsFilterValuesType } from '@/validation/actor/general/displaceds/displaceds-filter-form';

function Displaced_List_Header() {
  const { user } = useAuth();

  const router = useRouter();
  const showAddButton = user?.role == USER_TYPE.DELEGATE || user?.role == USER_TYPE.MANAGER;

  return (
    <Group justify='space-between' align='center'>
      <Group gap={10}>
        <Database size={20} className='!text-primary' />
        <Text fw={600} fz={18} className='!text-primary'>
          بيانات النازحين :
        </Text>
      </Group>
      {false && showAddButton && (
        <Button
          size='sm'
          fz={16}
          fw={500}
          c='white'
          radius='lg'
          className='!bg-primary'
          rightSection={<UserPlus size={16} />}
          onClick={() => router.push(GENERAL_ACTOR_ROUTES.ADD_DISPLACEDS)}
        >
          إضافة نازح
        </Button>
      )}
    </Group>
  );
}

export default function Displaceds_List() {
  const [localFilters, setLocalFilters] = useState<displacedsFilterValuesType>({
    wife_status: null,
    family_number: null,
    ages: [],
    chronic_disease: null,
    accommodation_type: null,
    family_status_type: null,
    delegate: [],
  });

  const [displacedNum, setDisplacedNum] = useState(0);

  return (
    <Stack p={10} pos='relative' w='100%'>
      <Displaced_List_Header />

      <Suspense fallback={<div>جارٍ التحميل...</div>}>
        <Displaceds_Filters setLocalFilters={setLocalFilters} displacedNum={displacedNum} />
      </Suspense>

      <Suspense fallback={<div>جارٍ التحميل...</div>}>
        <Displaceds_Table localFilters={localFilters} setDisplacedNum={setDisplacedNum} />
      </Suspense>
    </Stack>
  );
}
