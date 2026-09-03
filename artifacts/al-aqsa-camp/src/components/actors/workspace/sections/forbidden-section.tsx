import React from 'react';
import { Title, Text, Button } from '@mantine/core';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

export default function ForbiddenSection({ section }: { section: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 animate-in fade-in zoom-in-95">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2">
        <ShieldAlert size={40} />
      </div>
      <Title order={2} className="font-display text-2xl text-slate-800 dark:text-slate-200">
        صلاحية غير متوفرة
      </Title>
      <Text className="text-muted-foreground max-w-md">
        عذراً، حسابك لا يملك الصلاحيات الكافية للوصول إلى قسم <span className="font-bold">"{section}"</span>. يرجى مراجعة إدارة المخيم إذا كنت تعتقد أن هذا خطأ.
      </Text>
      
      <div className="pt-6">
        <Link href="/actor/profile" className="no-underline">
          <Button variant="light" color="gray" leftSection={<ArrowRight size={16} />}>
            العودة لملف الحساب
          </Button>
        </Link>
      </div>
    </div>
  );
}