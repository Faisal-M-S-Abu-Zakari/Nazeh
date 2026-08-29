'use client';
import { Box, Button, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import React from 'react';
import { Image } from '@/lib/nextjs-mocks';
import {
  Database,
  FileChartLine,
  Handshake,
  LogOut,
  MessageCircleWarning,
  Newspaper,
  ShieldUser,
  User,
  Users,
} from 'lucide-react';
import { logout } from '@/utils/auth/logout';
import { Link as Link } from '@/lib/nextjs-mocks';
import { usePathname  } from '@/lib/nextjs-mocks';
import { cn } from '@/utils/cn';
import { MAN } from '@/assets/actor';

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { label: 'الملف الشخصي', href: '/actor/manager', icon: User },
    { label: 'بيانات النازحين', href: '/', icon: Users },
    { label: 'بيانات المناديب', href: '/', icon: Database },
    { label: 'بيانات الأمن', href: '/', icon: ShieldUser },
    { label: 'إدارة المساعدات', href: '/', icon: Handshake },
    { label: 'الشكاوي', href: '/', icon: MessageCircleWarning },
    { label: 'التقارير', href: '/', icon: FileChartLine },
    { label: 'الإعلانات و المدونات', href: '/', icon: Newspaper },
  ];

  return (
    <Stack p={10} w={'100%'} h='100%' justify='flex-start' align='center'>
      {/* Header */}
      <Stack
        w={'100%'}
        justify='center'
        align='center'
        gap={10}
        pb={10}
        className='!shadow-xl !rounded-[20px] !overflow-hidden'
      >
        {/* Image */}
        <Box
          w={'100%'}
          h={70}
          className='!relative !bg-gradient-to-l !from-primary !to-white !rounded-[20px]'
        >
          <Box
            pos={'absolute'}
            bottom={'-50%'}
            left={'50%'}
            className='bg-primary !rounded-full !overflow-hidden !-translate-x-1/2'
            w={85}
            h={85}
          >
            <Image src={MAN} alt='man' width={85} height={85} className='!object-cover' />
          </Box>
        </Box>

        <Group justify='center' align='baseline' px={5} mt={30} wrap='nowrap'>
          <Text fw={500} fz={20} c={'white'} className='!text-primary !text-nowrap'>
            المدير :
          </Text>

          <Text fw={500} fz={20} c={'white'} className='!text-primary'>
            مصطفي الجزار
          </Text>
        </Group>
        <Text fw={500} fz={16} c={'white'} ta={'center'} className='!text-primary'>
          960128155
        </Text>

        <Button
          data-testid='navbar-logout'
          variant='transparent'
          size='xs'
          radius='md'
          fw={500}
          fz={16}
          color={'gray'}
          leftSection={<LogOut size={20} />}
          onClick={logout}
        >
          تسجيل الخروج
        </Button>
      </Stack>
      {/* Navigation Links */}
      <Box w={'100%'} className='!shadow-xl !rounded-[20px] !overflow-hidden'>
        {navLinks.map((item, index) => {
          const isActive = pathname === item.href;

          return (
            <Link href={item.href} key={index} passHref>
              <Button
                variant='transparent'
                size='xs'
                w={'100%'}
                h={45}
                ta={'start'}
                className={cn(
                  // Using cn here
                  '!flex !justify-start !border-0 !border-gray-300 !border-b-1 !rounded-none !overflow-hidden',
                  {
                    '!bg-gradient-to-l !from-primary !to-white': isActive, // Gradient when active
                    '!bg-white': !isActive, // White when inactive
                  }
                )}
              >
                <ThemeIcon variant='transparent' className='!text-primary'>
                  <item.icon size={22} className='!text-dark' />
                </ThemeIcon>

                <Text fw={600} fz={20} c={'dark'} ps={15}>
                  {item.label}
                </Text>
              </Button>
            </Link>
          );
        })}
      </Box>
    </Stack>
  );
}
