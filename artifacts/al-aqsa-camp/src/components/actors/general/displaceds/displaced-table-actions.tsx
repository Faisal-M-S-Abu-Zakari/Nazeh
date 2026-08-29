'use client';

import { DISPLACED_ROUTES_fUNC } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { ActionIcon, Button, Popover, Stack, ThemeIcon } from '@mantine/core';
import {
  EllipsisVertical,
  Eye,
  Hammer,
  Repeat,
  Speech,
  Trash,
  UserCog,
  UserPen,
  Users,
} from 'lucide-react';
import { useRouter  } from '@/lib/nextjs-mocks';
import { useState } from 'react';
import useAuth from '@/hooks/useAuth';
import Delete_Displaced_Modal from './modals/delete-displaced-modal';
import Call_Displaced_Modal from './modals/call-displaceds-modal';
import Update_Displaced_Modal from './modals/update-displaced-modal';
import Meeting_Displaced_Modal from './modals/meeting-displaced-modal';
import Change_Delegate_In_Displaced_Modal from './modals/change-delegate-in-displaceds-modal';
import { ACTION_ADD_EDIT_DISPLAY } from '@/@types/actors/common-types/index.type';
import type { Displaced } from '@/@types/actors/general/displaceds/displacesResponse.type';

interface ActionItem {
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  action: () => void;
}

interface DisplacedTableActionsProps {
  displaced?: Displaced;
  displaced_Ids?: number[];
  disabled?: boolean;
}

export default function Displaced_Table_Actions({
  displaced,
  displaced_Ids,
  disabled,
}: DisplacedTableActionsProps) {
  const { isDelegate, isManager, isSecurity, isSecurityOfficer } = useAuth();
  const [openedPopover, setOpenedPopover] = useState(false);
  const [modalType, setModalType] = useState<
    'change_delegate' | 'edit' | 'delete' | 'call' | 'update' | 'meeting' | null
  >(null);

  const router = useRouter();

  const openModal = (type: typeof modalType) => {
    setModalType(type);
    setOpenedPopover(false);
  };

  const closeModal = () => setModalType(null);

  const commonActions: ActionItem[] = [
    { label: 'أرشفة', icon: Trash, action: () => openModal('delete') },
    { label: 'استدعاء', icon: Speech, action: () => openModal('call') },
    { label: 'تحديث بيانات', icon: UserCog, action: () => openModal('update') },
    { label: 'اجتماع', icon: Users, action: () => openModal('meeting') },
  ];

  const managerExtras: ActionItem[] = [
    {
      label: 'تغيير المندوب',
      icon: Repeat,
      action: () => openModal('change_delegate'),
    },
  ];

  const viewEditActions: ActionItem[] = [
    {
      label: 'تعديل',
      icon: UserPen,
      action: () => openModal('edit'),
    },
  ];

  const securityActions: ActionItem[] = [];

  const getActions = (): ActionItem[] => {
    // The synchronized API requires each record's UUID and version. Bulk selections
    // intentionally have only display IDs, so do not expose a nonfunctional archive.
    if (displaced_Ids) return [];
    if (isManager && displaced) return [...viewEditActions, ...commonActions, ...managerExtras];
    if (isDelegate && displaced_Ids) return [...commonActions];
    if (isDelegate && displaced) return [...viewEditActions, ...commonActions];
    if (isSecurity || isSecurityOfficer) return securityActions;
    return [];
  };

  const ACTIONS = getActions();
  const IDs = displaced_Ids || (displaced ? [displaced.id] : []);

  const Dropdown_Items = ACTIONS.map((item, index) => (
    <Button
      key={item.label}
      data-testid={`person-action-${item.label}-${displaced?.apiId ?? 'bulk'}`}
      justify='flex-start'
      leftSection={
        <ThemeIcon variant='transparent' className='!text-dark'>
          <item.icon size={16} />
        </ThemeIcon>
      }
      p={0}
      bg='transparent'
      fz={16}
      fw={500}
      className={cn(
        'hover:!bg-second-light !rounded-none !text-dark',
        index + 1 !== ACTIONS.length && '!border-gray-100 !border-0 !border-b-1'
      )}
      onClick={item.action}
    >
      {item.label}
    </Button>
  ));

  if (ACTIONS.length === 0) return null;

  return (
    <>
      <Popover
        width={150}
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
          {displaced_Ids ? (
            <Button
              type='button'
              w={130}
              size='sm'
              px={15}
              fz={16}
              fw={500}
              c='white'
              radius='md'
              className='!justify-end !items-end !self-end !bg-primary !shadow-lg'
              rightSection={<Hammer size={15} />}
              disabled={disabled}
              onClick={() => setOpenedPopover((o) => !o)}
            >
              العمليات
            </Button>
          ) : (
            <ActionIcon data-testid={`person-actions-${displaced?.apiId}`} bg='transparent' mt={5} onClick={() => setOpenedPopover((o) => !o)}>
              <EllipsisVertical size={20} className='mx-auto text-primary' />
            </ActionIcon>
          )}
        </Popover.Target>
        <Popover.Dropdown p={0} className='!bg-gray-200 !border-none'>
          <Stack justify='flex-start' gap={0}>
            {Dropdown_Items}
          </Stack>
        </Popover.Dropdown>
      </Popover>

      {isManager && (
        <Change_Delegate_In_Displaced_Modal
          displaced_Ids={IDs}
          opened={modalType === 'change_delegate'}
          close={closeModal}
        />
      )}

      {(isDelegate || isManager) && (
        <Delete_Displaced_Modal
          people={displaced ? [displaced] : []}
          opened={modalType === 'delete'}
          close={closeModal}
        />
      )}

      <Call_Displaced_Modal displaced_Ids={IDs} opened={modalType === 'call'} close={closeModal} />

      {(isDelegate || isManager) && (
        <Update_Displaced_Modal
          person={displaced}
          opened={modalType === 'update'}
          close={closeModal}
        />
      )}
      {(isDelegate || isManager) && displaced && (
        <Update_Displaced_Modal
          person={displaced}
          opened={modalType === 'edit'}
          close={closeModal}
        />
      )}

      {(isDelegate || isManager) && (
        <Meeting_Displaced_Modal
          displaced_Ids={IDs}
          opened={modalType === 'meeting'}
          close={closeModal}
        />
      )}
    </>
  );
}
