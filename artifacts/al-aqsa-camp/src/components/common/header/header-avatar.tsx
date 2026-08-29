'use client';

import { Avatar, Popover, Button, Stack, Text, Divider, Group } from '@mantine/core';
import { useRouter  } from '@/lib/nextjs-mocks';
import useAuth from '@/hooks/useAuth';
import { logout } from '@/utils/auth/logout';
import { MAN } from '@/assets/actor';
import { User, LogOut } from 'lucide-react';
import { USER_RANK } from '@/constants/userTypes';
import {
  DELEGATE_ROUTES_fUNC,
  DISPLACED_ROUTES_fUNC,
  MANAGER_ROUTES_fUNC,
  SECURITY_ROUTES_fUNC,
} from '@/constants/routes';

export default function Header_Avatar() {
  const { user } = useAuth();
  const router = useRouter();

  const goToProfile = () => {
    if (!user) return;

    let route: string | undefined;

    switch (user.role) {
      case USER_RANK.DISPLACED:
        route = DISPLACED_ROUTES_fUNC({ displaced_Id: user.id }).PROFILE;
        break;
      case USER_RANK.DELEGATE:
        route = DELEGATE_ROUTES_fUNC({ delegate_Id: user.id }).PROFILE;
        break;
      case USER_RANK.MANAGER:
        route = MANAGER_ROUTES_fUNC({ manager_Id: user.id }).PROFILE;
        break;
      case USER_RANK.SECURITY:
        route = SECURITY_ROUTES_fUNC({ security_Id: user.id }).PROFILE;
        break;
    }

    if (route) {
      router.push(route);
    }
  };

  return (
    <Popover position='bottom-end' withArrow shadow='md'>
      <Popover.Target>
        <Avatar
          data-testid='header-account-menu'
          src={MAN || user?.profile_image || MAN}
          alt={user?.name || 'User'}
          radius='xl'
          size={44}
          className='!border-[0.5px] !border-gray-300 !rounded-full hover:scale-105 transition-transform cursor-pointer'
        />
      </Popover.Target>

      <Popover.Dropdown p='sm' className='min-w-[200px]'>
        <Group align='center' gap='sm' mb='xs'>
          <Avatar
            src={user?.profile_image || MAN}
            alt={user?.name || 'User'}
            radius='xl'
            size={42}
            className='!border-[0.5px] !border-gray-300 !rounded-full'
          />
          <Stack gap={0}>
            <Text fw={600} size='sm'>
              {user?.name || 'User'}
            </Text>
            {user?.email && (
              <Text size='xs' c='dimmed'>
                {user.email}
              </Text>
            )}
          </Stack>
        </Group>

        <Divider mb='xs' />

        <Stack gap='xs'>
          <Button
            variant='light'
            size='xs'
            radius='md'
            leftSection={<User size={16} />}
            onClick={goToProfile}
          >
            الملف الشخصي
          </Button>
          <Button
            data-testid='header-logout'
            variant='light'
            color='red'
            size='xs'
            radius='md'
            leftSection={<LogOut size={16} />}
            onClick={logout}
          >
            تسجيل الخروج
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
