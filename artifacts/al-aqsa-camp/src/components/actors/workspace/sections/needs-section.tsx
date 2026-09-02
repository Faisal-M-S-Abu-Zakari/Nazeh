import { useState, useMemo } from 'react';
import { useListNeeds, getListNeedsQueryKey, useListFamilies, getListFamiliesQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Labels, StatusVariant } from '../shared/labels';
import { LoadingState, ErrorState, EmptyState } from '../shared/ui-states';
import { ClipboardList, User } from 'lucide-react';

export default function NeedsSection() {
  const [statusFilter, setStatusFilter] = useState('');
  
  const needs = useListNeeds({ query: { queryKey: getListNeedsQueryKey() } });
  const families = useListFamilies({ query: { queryKey: getListFamiliesQueryKey() } });

  const getFamilyName = (id: string) => {
    return families.data?.find((f: any) => f.id === id)?.headName ?? `أسرة #${id.slice(0, 6)}`;
  };

  const filteredNeeds = useMemo(() => {
    if (!needs.data) return [];
    return needs.data.filter((need: any) => {
      const matchStatus = statusFilter ? need.status === statusFilter : true;
      return matchStatus;
    });
  }, [needs.data, statusFilter]);

  if (needs.isLoading) return <LoadingState message="تحميل الاحتياجات..." />;
  if (needs.isError) return <ErrorState message="حدث خطأ أثناء جلب الاحتياجات." />;

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">الاحتياجات</h1>
        <p className="text-muted-foreground mt-2">متابعة وتحديث طلبات الاحتياج المرفوعة للأسر.</p>
      </header>

      <div className="flex gap-4 mb-6">
        <select 
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">جميع الحالات</option>
          <option value="REQUIRED">مطلوب</option>
          <option value="APPROVED">معتمد للتوزيع</option>
          <option value="IN_PROGRESS">قيد المعالجة</option>
          <option value="FULFILLED">منفّذ</option>
        </select>
      </div>

      {filteredNeeds.length === 0 ? (
        <EmptyState title="لا توجد احتياجات" description="لم يتم العثور على طلبات مطابقة." icon={ClipboardList} />
      ) : (
        <div className="space-y-4">
          {filteredNeeds.map((need: any) => (
            <Card key={need.id} className="transition-all hover:border-primary/40">
              <CardContent className="p-5 sm:flex sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div>
                  <h3 className="font-bold text-lg">{need.title}</h3>
                  <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="size-4" />
                      <span>{getFamilyName(need.familyId)}</span>
                    </div>
                    <span>•</span>
                    <span>الأولوية: {Labels[need.priority] ?? need.priority}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={StatusVariant(need.status) as any}>{Labels[need.status] ?? need.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
