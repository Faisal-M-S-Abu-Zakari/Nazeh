import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Text } from '@mantine/core';

export function LoadingState({ message = 'جاري التحميل...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-primary opacity-80 animate-in fade-in">
      <Loader2 size={32} className="animate-spin" />
      <Text className="font-medium">{message}</Text>
    </div>
  );
}

export function ErrorState({ message = 'حدث خطأ. يرجى المحاولة مرة أخرى.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-red-500 animate-in fade-in zoom-in-95">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
        <AlertCircle size={32} />
      </div>
      <Text fw={500} size="lg">{message}</Text>
    </div>
  );
}