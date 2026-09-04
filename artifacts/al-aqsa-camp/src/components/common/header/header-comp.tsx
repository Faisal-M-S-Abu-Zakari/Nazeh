'use client';
import { AppShell, Burger, Button, Flex, Group, Paper } from '@mantine/core';
import { Image } from '@/lib/nextjs-mocks';
import { Link as Link } from '@/lib/nextjs-mocks';
import { AUTH_ROUTES, LANDING_ROUTES } from '@/constants/routes';
import { usePathname  } from '@/lib/nextjs-mocks';
import useAuth from '@/hooks/useAuth';
import { LOGO } from '@/assets/common';
import { LogIn } from 'lucide-react';
import Header_Links from '@/components/common/header/header-links';
import Header_Avatar from '@/components/common/header/header-avatar';
import Header_Drawer from '@/components/common/header/header-drawer';

interface Props {
  opened: boolean;
  toggle: () => void;
}

export default function HeaderComp({ opened, toggle }: Props) {
  const pathname = usePathname();
  const isActor = pathname.includes('actor');
  const { isAuthenticated } = useAuth();

  return (
    <AppShell.Header zIndex={50} withBorder={false} className='!bg-second-light shadow-sm'>
      <Flex justify='space-between' align='center' h='100%' px='lg'>
        <Group gap='md'>
          {!isActor && <Burger opened={opened} onClick={toggle} hiddenFrom='lg' size='sm' />}
          <Link href={LANDING_ROUTES.HOME} className='flex items-center'>
            <Image
              src={LOGO}
              alt='Logo'
              width={60}
              height={60}
              className='hover:opacity-90 rounded-lg transition-opacity'
              priority
            />
          </Link>
        </Group>

        {!isActor && (
          <Group gap={32} visibleFrom='lg'>
            <Header_Links />
          </Group>
        )}

        <Group gap='sm'>
          {isAuthenticated ? (
            <Header_Avatar />
          ) : (
            <Link href={AUTH_ROUTES.LOGIN}>
              <Button
                size='sm'
                variant='outline'
                // px='md'
                fz={14}
                fw={500}
                radius='md'
                rightSection={<LogIn size={18} />}
                // className='hover:!bg-primary text-primary hover:!text-white transition-colors duration-150'
              >
                دخول
              </Button>
            </Link>
          )}
        </Group>
      </Flex>

      <Header_Drawer opened={opened} toggle={toggle} />
    </AppShell.Header>
  );
}
