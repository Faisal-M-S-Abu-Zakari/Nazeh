import { useState, useMemo } from 'react';
import { useListTasks, getListTasksQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Labels, StatusVariant } from '../shared/labels';
import { LoadingState, ErrorState, EmptyState } from '../shared/ui-states';
import { CheckSquare, MapPin } from 'lucide-react';

export default function TasksSection() {
  const [statusFilter, setStatusFilter] = useState('');
  
  const tasks = useListTasks({ query: { queryKey: getListTasksQueryKey() } });

  const filteredTasks = useMemo(() => {
    if (!tasks.data) return [];
    return tasks.data.filter((task: any) => {
      return statusFilter ? task.status === statusFilter : true;
    });
  }, [tasks.data, statusFilter]);

  if (tasks.isLoading) return <LoadingState message="تحميل المهام..." />;
  if (tasks.isError) return <ErrorState message="حدث خطأ أثناء جلب المهام." />;

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">المهام الأمنية والميدانية</h1>
        <p className="text-muted-foreground mt-2">سجل المهام المسندة والتحديثات المتعلقة بها.</p>
      </header>

      <div className="flex gap-4 mb-6">
        <select 
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">جميع الحالات</option>
          <option value="PENDING">قيد الانتظار</option>
          <option value="IN_PROGRESS">جارِ التنفيذ</option>
          <option value="COMPLETED">مكتملة</option>
        </select>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState title="لا توجد مهام" description="المهام المسندة فارغة حالياً." icon={CheckSquare} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTasks.map((task: any) => (
            <Card key={task.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <h3 className="font-bold text-lg leading-tight">{task.title}</h3>
                  <Badge variant={StatusVariant(task.status) as any} className="whitespace-nowrap">
                    {Labels[task.status] ?? task.status}
                  </Badge>
                </div>
                {task.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <MapPin className="size-4" />
                    <span>{task.location}</span>
                  </div>
                )}
                {task.description && (
                  <p className="text-sm text-slate-600 p-3 bg-muted/30 rounded-md leading-relaxed">
                    {task.description}
                  </p>
                )}
                {task.approvedAt && (
                  <div className="mt-4 pt-3 border-t text-xs text-emerald-600 font-medium">
                    تم الاعتماد: {new Date(task.approvedAt).toLocaleDateString('ar-EG')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
