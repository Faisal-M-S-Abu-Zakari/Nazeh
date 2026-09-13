import Actor_Navbar from '@/components/actors/common/navbar/actor-navbar';
import { Burger, Drawer, Text } from '@mantine/core';
import React from 'react';
import { NAZEH_LOGO } from '@/assets/common';

export default function ActorLayout({ children }: { children: React.ReactNode }) {
  const [opened, setOpened] = React.useState(false);

  return (
    <div data-testid="actor-layout" className="flex min-h-[100dvh] w-full bg-background" dir="rtl">
      {/* Mobile Header */}
      <header className="fixed inset-x-0 top-[60px] z-40 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <img src={NAZEH_LOGO} alt="نازح" className="h-12 w-auto" />
          <Text fw={700} fz={11} c="dimmed" className="hidden min-[340px]:block">إدارة المخيمات الإنسانية</Text>
        </div>
        <Burger opened={opened} onClick={() => setOpened(!opened)} aria-label="فتح القائمة الرئيسية" size="sm" color="var(--color-primary)" />
      </header>

      {/* Mobile Drawer */}
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="right"
        size="280px"
        withCloseButton={false}
        padding={0}
        classNames={{ body: 'h-full p-0 flex flex-col bg-sidebar' }}
      >
        <Actor_Navbar onNavigate={() => setOpened(false)} />
      </Drawer>

      {/* Desktop Sidebar */}
      <aside className="fixed bottom-0 right-0 top-[60px] z-30 hidden w-[260px] flex-col border-l border-sidebar-border bg-sidebar lg:flex shadow-sm">
        <Actor_Navbar />
      </aside>

      {/* Main Content Area */}
      <main className="flex min-w-0 flex-1 flex-col pt-[124px] transition-all duration-300 lg:mr-[260px] lg:pt-[60px] h-[100dvh] overflow-hidden bg-slate-50/50 dark:bg-background">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
