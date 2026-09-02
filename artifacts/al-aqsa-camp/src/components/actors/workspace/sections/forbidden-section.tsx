import { ShieldAlert } from 'lucide-react';

export default function ForbiddenSection({ section }: { section: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[50vh] animate-in fade-in zoom-in duration-300">
      <div className="p-6 bg-destructive/10 text-destructive rounded-full mb-6 ring-8 ring-destructive/5">
        <ShieldAlert className="size-12" />
      </div>
      <h1 className="text-3xl font-bold mb-3">غير مصرح بالوصول</h1>
      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
        عذراً، صلاحيات حسابك الحالي لا تتيح لك الوصول إلى قسم <strong className="text-foreground">{section}</strong>. 
        يُرجى العودة للصفحة السابقة أو مراجعة مدير النظام إذا كنت تعتقد أن هذا خطأ.
      </p>
    </div>
  );
}
