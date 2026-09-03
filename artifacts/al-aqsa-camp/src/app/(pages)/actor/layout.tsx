import Actor_Navbar from '@/components/actors/common/navbar/actor-navbar';
import React from 'react';

export default function ActorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="actor-layout" className="flex min-h-screen bg-slate-50 dark:bg-background" dir="rtl">
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 right-0 z-50">
        <Actor_Navbar />
      </aside>
      <main className="flex-1 flex flex-col min-w-0 lg:mr-64 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}