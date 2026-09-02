'use client';

import { DELEGATE_ROUTES_fUNC } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { ActionIcon, Button, Popover, Stack, ThemeIcon } from '@mantine/core';
import {
  EllipsisVertical,
  Hammer,
  Speech,
  Trash,
  UserCog,
  Users,
} from 'lucide-react';
import { ComponentType, useState } from 'react';
import useAuth from '@/hooks/useAuth';
import Call_Delegate_Modal from './modals/call-delegate-modal';
import Delete_Delegate_Modal from './modals/delete-delegate-modal';
import Update_Delegate_Modal from './modals/update-delegate-modal';
import Meeting_Delegate_Modal from './modals/meeting-delegate-modal';

interface ActionItem {
  label: string;
  icon: ComponentType<{ size?: number | string }>;
  action: () => void;
}

interface Props {
  delegate_Id?: number;
  delegate_Ids?: number[];
  disabled?: boolean;
}

export default function Delegates_Table_Actions({ delegate_Id, delegate_Ids, disabled }: Props) {
  const { isManager, isSecurity, isSecurityOfficer } = useAuth();
  const [openedPopover, setOpenedPopover] = useState(false);
  const [modalType, setModalType] = useState<
    'edit' | 'delete' | 'call' | 'update' | 'meeting' | null
  >(null);

  const openModal = (type: typeof modalType) => {
    setModalType(type);
    setOpenedPopover(false);
  };

  const closeModal = () => setModalType(null);

  const commonActions: ActionItem[] = [
    { label: 'حذف', icon: Trash, action: () => openModal('delete') },
    { label: 'استدعاء', icon: Speech, action: () => openModal('call') },
    { label: 'تحديث بيانات', icon: UserCog, action: () => openModal('update') },
    { label: 'اجتماع', icon: Users, action: () => openModal('meeting') },
  ];

  const securityActions: ActionItem[] = [
    { label: 'استدعاء', icon: Speech, action: () => openModal('call') },
  ];

  const getActions = (): ActionItem[] => {
    if (isManager && delegate_Ids) return [...commonActions];
    if (isManager && delegate_Id) return [...commonActions];
    if (isSecurity || isSecurityOfficer) return securityActions;
    return [];
  };

  const ACTIONS = getActions();
  const IDs = delegate_Ids || (delegate_Id ? [delegate_Id] : []);

  const Dropdown_Items = ACTIONS.map((item, index) => (
    <Button
      key={item.label}
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
          {delegate_Ids ? (
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
            <ActionIcon bg='transparent' mt={5} onClick={() => setOpenedPopover((o) => !o)}>
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
        <Delete_Delegate_Modal
          delegate_Ids={IDs}
          opened={modalType === 'delete'}
          close={closeModal}
        />
      )}

      <Call_Delegate_Modal delegate_Ids={IDs} opened={modalType === 'call'} close={closeModal} />

      <Update_Delegate_Modal
        delegate_Ids={IDs}
        opened={modalType === 'update'}
        close={closeModal}
      />

      <Meeting_Delegate_Modal
        delegate_Ids={IDs}
        opened={modalType === 'meeting'}
        close={closeModal}
      />
    </>
  );
}
