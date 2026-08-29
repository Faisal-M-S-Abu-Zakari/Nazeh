'use client';

import { DELEGATE_ROUTES_fUNC, MANAGER_ROUTES_fUNC } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { ActionIcon, Button, Popover, Stack, ThemeIcon } from '@mantine/core';
import { EllipsisVertical, Eye, Trash, UserPen, UserPlus } from 'lucide-react';
import { useRouter  } from '@/lib/nextjs-mocks';
import { useState } from 'react';
import useAuth from '@/hooks/useAuth';
import { USER_RANK, USER_TYPE, UserRank } from '@/constants/userTypes';
import {
  ACTION_ADD_EDIT_DISPLAY,
  DISTRIBUTION_MECHANISM,
  TYPE_GROUP_AIDS,
} from '@/@types/actors/common-types/index.type';
import { parseAsStringEnum, useQueryStates } from 'nuqs';
import type { Aid } from '@/@types/actors/manager/aid-management/add-aid-management.types';
import Common_Aid_Delete_Modal from './common-aid-delete-modal';
import Common_Aid_Edit_Modal from './common-aid-edit-modal';

interface ActionItem {
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  action: () => void;
}

interface CommonAidActionProps {
  aid: Aid;
  aid_distribution_mechanism: DISTRIBUTION_MECHANISM;
  actor_Id: number;
  role: Exclude<
    (typeof USER_RANK)[UserRank],
    typeof USER_RANK.SECURITY_OFFICER | typeof USER_TYPE.DISPLACED | typeof USER_TYPE.SECURITY
  >;
}

export default function Common_Aid_Action({
  aid,
  aid_distribution_mechanism,
  actor_Id,
  role,
}: CommonAidActionProps) {
  const [query] = useQueryStates({
    'aids-tab': parseAsStringEnum<TYPE_GROUP_AIDS>(Object.values(TYPE_GROUP_AIDS)).withDefault(
      TYPE_GROUP_AIDS.ONGOING_AIDS
    ),
  });

  const { user, isManager, isDelegate, isSecurityOfficer } = useAuth();
  const [openedPopover, setOpenedPopover] = useState(false);
  const [modal, setModal] = useState<'edit' | 'archive' | null>(null);
  const aid_Id = aid.id;

  const router = useRouter();
  const isOwner = actor_Id === user?.id;

  const routeFunc =
    role === USER_TYPE.MANAGER
      ? MANAGER_ROUTES_fUNC({ manager_Id: actor_Id, aid_Id })
      : DELEGATE_ROUTES_fUNC({ delegate_Id: actor_Id, aid_Id });

  const ACTIONS: ActionItem[] = (() => {
    if ((isManager || isDelegate) && aid.apiId && aid.version !== undefined) {
        return [
          {
            label: 'عرض',
            icon: Eye,
            action: () => router.push(routeFunc.AID),
          },
          {
            label: 'تعديل',
            icon: UserPen,
            action: () => setModal('edit'),
          },
          { label: 'أرشفة', icon: Trash, action: () => setModal('archive') },
        ];
    }

    if (role === USER_TYPE.MANAGER && isManager && !isOwner) {
      return [{ label: 'عرض', icon: Eye, action: () => router.push(routeFunc.AID) }];
    }

    if (role === USER_TYPE.DELEGATE && isDelegate && isOwner) {
      if (
        aid_distribution_mechanism === DISTRIBUTION_MECHANISM.DELEGATES_LISTS &&
        query['aids-tab'] === TYPE_GROUP_AIDS.COMING_AIDS
      ) {
        return [
          {
            label: 'عرض',
            icon: Eye,
            action: () => router.push(routeFunc.AID),
          },
          {
            label: 'إضافة نازحين',
            icon: UserPlus,
            action: () =>
              router.push(
                DELEGATE_ROUTES_fUNC({ delegate_Id: actor_Id, aid_Id }).ADD_AID_DISPLACEDS
              ),
          },
        ];
      } else {
        return [
          {
            label: 'عرض',
            icon: Eye,
            action: () => router.push(routeFunc.AID),
          },
        ];
      }
    }

    return [
      {
        label: 'عرض',
        icon: Eye,
        action: () => router.push(DELEGATE_ROUTES_fUNC({ delegate_Id: actor_Id, aid_Id }).AID),
      },
    ];
  })();

  const Dropdown_Items = ACTIONS.map((item, index) => (
    <Button
      key={index}
      data-testid={`aid-action-${item.label}-${aid.apiId ?? aid.id}`}
      justify='flex-start'
      px={10}
      leftSection={
        <ThemeIcon variant='transparent' className='!text-dark'>
          <item.icon size={18} />
        </ThemeIcon>
      }
      p={0}
      bg='transparent'
      fz={16}
      fw={500}
      className={cn(
        '!rounded-none !text-dark',
        index + 1 !== ACTIONS.length && '!border-gray-100 !border-0 !border-b-1'
      )}
      onClick={(e) => {
        e.stopPropagation();
        item.action();
        setOpenedPopover(false);
      }}
    >
      {item.label}
    </Button>
  ));

  return (
    <>
      <Popover
        opened={openedPopover}
        onChange={setOpenedPopover}
        position='left-start'
        withArrow
        arrowPosition='center'
        arrowSize={12}
        arrowRadius={3}
        arrowOffset={10}
        classNames={{ arrow: '!border-none' }}
      >
        <Popover.Target>
          <ActionIcon
            data-testid={`aid-actions-${aid.apiId ?? aid.id}`}
            bg='transparent'
            mt={5}
            onClick={(e) => {
              e.stopPropagation();
              setOpenedPopover((o) => !o);
            }}
          >
            <EllipsisVertical size={20} className='text-primary' />
          </ActionIcon>
        </Popover.Target>

        <Popover.Dropdown p={0} className='!bg-gray-200 !border-none'>
          <Stack gap={0}>{Dropdown_Items}</Stack>
        </Popover.Dropdown>
      </Popover>
      <Common_Aid_Edit_Modal aid={aid} opened={modal === 'edit'} close={() => setModal(null)} />
      <Common_Aid_Delete_Modal aid={aid} actor_Id={actor_Id} opened={modal === 'archive'} close={() => setModal(null)} />
    </>
  );
}
