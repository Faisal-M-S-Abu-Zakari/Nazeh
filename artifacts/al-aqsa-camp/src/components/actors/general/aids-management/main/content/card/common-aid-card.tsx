'use client';

import { cn } from '@/utils/cn';
import { Card, Center, Flex, Group, Stack, Text } from '@mantine/core';
import { Package, UsersRound } from 'lucide-react';
import { Aid } from '@/@types/actors/manager/aid-management/add-aid-management.types';
import { useRouter  } from '@/lib/nextjs-mocks';
import useAuth from '@/hooks/useAuth';
import { parseAsStringEnum, useQueryStates } from 'nuqs';
import { USER_RANK, USER_TYPE, UserRank, UserType } from '@/constants/userTypes';
import Common_Aid_Action from './common-aid-action';
import { DELEGATE_ROUTES_fUNC, MANAGER_ROUTES_fUNC } from '@/constants/routes';
import {
  GET_AIDS_TYPE_ICONS,
  TYPE_AIDS,
  TYPE_GROUP_AIDS,
} from '@/@types/actors/common-types/index.type';

interface CommonAidCardProps {
  aid: Aid;
  actor_Id: number;
  role: Exclude<
    (typeof USER_RANK)[UserRank],
    typeof USER_RANK.SECURITY_OFFICER | typeof USER_TYPE.DISPLACED | typeof USER_TYPE.SECURITY
  >;
}

const getAidTypeIcon = (type: TYPE_AIDS) => {
  const IconComponent = GET_AIDS_TYPE_ICONS[type] || Package;
  return <IconComponent size={20} className='text-white' />;
};

export default function Common_Aid_Card({ aid, actor_Id, role }: CommonAidCardProps) {
  const [query] = useQueryStates({
    'aids-tab': parseAsStringEnum<TYPE_GROUP_AIDS>(Object.values(TYPE_GROUP_AIDS)).withDefault(
      TYPE_GROUP_AIDS.ONGOING_AIDS
    ),
  });

  const router = useRouter();
  const { user, isManager, isDelegate, isSecurityOfficer } = useAuth();
  const isOwner = actor_Id === user?.id;

  const handleClick = (e: React.MouseEvent) => {
    const path = e.nativeEvent.composedPath() as HTMLElement[];
    const clickedOnCard = path.some((el) => {
      const attr = (el as HTMLElement)?.getAttribute?.('data-click');
      const classes = (el as HTMLElement)?.classList?.toString() || '';
      return attr === 'aid-card' || classes.includes('aid-card');
    });

    if (!clickedOnCard) return;

    if (role === USER_TYPE.MANAGER && isManager) {
      router.push(`${MANAGER_ROUTES_fUNC({ manager_Id: actor_Id, aid_Id: aid.id }).AID}`);
    }

    if (
      role === USER_TYPE.DELEGATE &&
      (isManager || isSecurityOfficer || (isDelegate && isOwner))
    ) {
      router.push(`${DELEGATE_ROUTES_fUNC({ delegate_Id: actor_Id, aid_Id: aid.id }).AID}`);
    }
  };

  return (
    <Card
      data-click='aid-card'
      key={aid.id}
      p='xs'
      className={cn(
        '!bg-red-100 !shadow-md border-1 border-gray-200 rounded-lg hover:cursor-pointer',
        aid.is_completed && '!bg-green-100'
      )}
      onClick={handleClick}
    >
      <Group>
        <Center w={48} h={48} className='bg-primary border-1 border-gray-300 rounded-full'>
          {getAidTypeIcon(aid.aid_type as TYPE_AIDS)}
        </Center>

        <Stack flex={1} gap={5}>
          <Group justify='space-between'>
            <Flex
              direction={{ base: 'column-reverse', sm: 'row' }}
              flex={1}
              justify='space-between'
              wrap='wrap-reverse'
              gap={0}
            >
              <Text fz='md' fw={600} className='!text-primary'>
                {aid.aid_name || `مساعدة: ${aid.aid_type}`}
              </Text>
              <Text fz={14} c='dimmed'>
                {new Date(aid.delivery_date as Date).toLocaleDateString('ar-EG', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </Flex>

          </Group>

          <Group gap={20}>
            <Group gap={5}>
              <UsersRound size={15} className='!text-primary' />
              <Text fz={14} className='!text-dark'>
                عدد المستفيدين: {aid.selected_displaced_Ids.length}
              </Text>
            </Group>

            {query['aids-tab'] !== TYPE_GROUP_AIDS.COMING_AIDS && (
              <Group gap={5}>
                <UsersRound size={15} className='!text-primary' />
                <Text fz={14} className='!text-dark'>
                  عدد المستلمين: {aid.received_displaceds.length}
                </Text>
              </Group>
            )}
          </Group>

          {aid.additional_notes && (
            <Text fz={14} c='dimmed'>
              {aid.additional_notes}
            </Text>
          )}
          <Common_Aid_Action
            aid={aid}
            aid_distribution_mechanism={aid.distribution_mechanism}
            actor_Id={actor_Id}
            role={role}
          />
        </Stack>
      </Group>
    </Card>
  );
}
