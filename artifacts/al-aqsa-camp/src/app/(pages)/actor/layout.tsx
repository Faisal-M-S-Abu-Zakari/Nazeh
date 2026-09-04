import Actor_Navbar from '@/components/actors/common/navbar/actor-navbar';
import { Burger, Drawer, Text } from '@mantine/core';
import React from 'react';

export default function ActorLayout({ children }: { children: React.ReactNode }) {
  const [opened, setOpened] = React.useState(false);

  return (
    <div data-testid="actor-layout" className="flex min-h-screen bg-[#f6f8f6]" dir="rtl">
      <header className="fixed inset-x-0 top-[60px] z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">أقصى</div>
          <Text fw={800} className="font-display">مخيم الأقصى</Text>
        </div>
        <Burger opened={opened} onClick={() => setOpened(true)} aria-label="فتح القائمة الرئيسية" color="var(--mantine-color-teal-7)" />
      </header>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="right"
        size={300}
        withCloseButton={false}
        padding={0}
        classNames={{ body: 'h-full p-0' }}
      >
        <Actor_Navbar onNavigate={() => setOpened(false)} />
      </Drawer>

      <aside className="fixed bottom-0 right-0 top-[60px] z-30 hidden w-[284px] flex-col border-l border-slate-200 lg:flex">
        <Actor_Navbar />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col pt-[124px] transition-all duration-300 lg:mr-[284px] lg:pt-[60px]">
        {children}
      </main>
    </div>
  );
}