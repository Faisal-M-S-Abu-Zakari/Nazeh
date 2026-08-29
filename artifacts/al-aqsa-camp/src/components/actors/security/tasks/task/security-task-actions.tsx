'use client';

import { cn } from '@/utils/cn';
import { ActionIcon, Button, Popover, Stack, ThemeIcon } from '@mantine/core';
import { EllipsisVertical, Trash, Pencil } from 'lucide-react';
import { ComponentType, useState } from 'react';
import useAuth from '@/hooks/useAuth';
import Security_Delete_Task_Modal from './security-delete-task-modal';
import { Task } from '@/@types/actors/security/tasks/TasksResponse.type';
import Security_Task_Form_Modal from '../security-task-form-modal';

interface ActionItem {
  label: string;
  icon: ComponentType<{ size?: number | string }>;
  action: () => void;
}

interface SecurityTaskActionProps {
  security_Id: number;
  task: Task;
}

export default function Security_Task_Actions({ security_Id, task }: SecurityTaskActionProps) {
  const { isSecurityOfficer, isManager } = useAuth();
  const [openedPopover, setOpenedPopover] = useState(false);
  const [modalType, setModalType] = useState<'edit' | 'delete' | null>(null);

  const openModal = (type: typeof modalType) => {
    setModalType(type);
    setOpenedPopover(false);
  };

  const closeModal = () => setModalType(null);

  const ACTIONS: ActionItem[] = (isSecurityOfficer || isManager)
    ? [
        {
          label: 'تعديل',
          icon: Pencil,
          action: () => openModal('edit'),
        },
        {
          label: 'أرشفة',
          icon: Trash,
          action: () => openModal('delete'),
        },
      ]
    : [];

  const Dropdown_Items = ACTIONS.map((item, index) => (
    <Button
      data-click='action'
      data-testid={`task-action-${item.label}-${task.apiId ?? task.id}`}
      justify='flex-start'
      key={item.label}
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
      onClick={(e) => {
        e.stopPropagation();
        item.action();
      }}
    >
      {item.label}
    </Button>
  ));

  return (
    <>
      <Popover
        data-click='action'
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
          <ActionIcon
            data-click='action'
            data-testid={`task-actions-${task.apiId ?? task.id}`}
            bg='transparent'
            mt={5}
            onClick={() => setOpenedPopover((o) => !o)}
          >
            <EllipsisVertical size={20} className='mx-auto text-primary' />
          </ActionIcon>
        </Popover.Target>

        <Popover.Dropdown p={0} className='!bg-gray-200 !border-none'>
          <Stack justify='flex-start' gap={0}>
            {Dropdown_Items}
          </Stack>
        </Popover.Dropdown>
      </Popover>

      <Security_Delete_Task_Modal
        task={task}
        security_Id={security_Id}
        opened={modalType === 'delete'}
        close={closeModal}
      />

      <Security_Task_Form_Modal
        opened={modalType === 'edit'}
        onClose={closeModal}
        security_Id={security_Id}
        taskToEdit={task}
      />
    </>
  );
}
