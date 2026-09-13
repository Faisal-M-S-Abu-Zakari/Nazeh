'use client';

import { AppShell } from '@mantine/core';
import { useDisclosure, useHeadroom } from '@mantine/hooks';
import { ReactNode } from 'react';
import HeaderComp from '@/components/common/header/header-comp';
import Footer_Comp from '@/components/common/footer/footer-comp';
import { useLocation } from 'wouter';

export default function Pages_Mantine_Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pinned = useHeadroom({ fixedAt: 70 });
  const [opened, { toggle }] = useDisclosure();
  const [location] = useLocation();
  const isActorWorkspace = location === '/actor' || location.startsWith('/actor/');

  return (
    <AppShell
      header={{ height: 60, collapsed: !pinned, offset: false }}
      flex={1}
      withBorder={false}
      className='!flex !flex-col !w-full !min-h-screen'
    >
      <HeaderComp opened={opened} toggle={toggle} />

      <AppShell.Main
        flex={1}
        w={'100%'}
        h={'100%'}
        bg={'white'}
        className='!flex !flex-col !flex-1 !w-full !h-full'
      >
        {children}
      </AppShell.Main>

      {!isActorWorkspace && <Footer_Comp />}
    </AppShell>
  );
}
