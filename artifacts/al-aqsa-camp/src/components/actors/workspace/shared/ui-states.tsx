import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export function ErrorState({ message = 'تعذر تحميل البيانات. حاول مرة أخرى.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-destructive min-h-[300px]">
      <AlertCircle className="size-8" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export function LoadingState({ message = 'جارٍ التحميل...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground p-12 min-h-[300px]">
      <Loader2 className="size-8 animate-spin text-primary/60" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'لا توجد بيانات', description = 'لم يتم العثور على سجلات تطابق طلبك.', icon: Icon }: { title?: string, description?: string, icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-12 text-center text-muted-foreground bg-muted/20 min-h-[300px]">
      {Icon && <Icon className="size-10 text-muted-foreground/50" />}
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm mt-1">{description}</p>
      </div>
    </div>
  );
}
