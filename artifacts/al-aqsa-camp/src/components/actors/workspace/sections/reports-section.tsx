import { useListFamilies, useListNeeds, useListAids, useListTasks, useListCamps, useListSectors, getListFamiliesQueryKey, getListNeedsQueryKey, getListAidsQueryKey, getListTasksQueryKey, getListCampsQueryKey, getListSectorsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState, ErrorState } from '../shared/ui-states';
import { BarChart3, Users, ClipboardList, Package, Map, Home, CheckSquare } from 'lucide-react';
import useAuth from '@/hooks/useAuth';

export default function ReportsSection() {
  const { isManager, isDelegate, isSecurity, isSecurityOfficer } = useAuth();
  const canViewFamilies = isManager || isDelegate;
  const canViewNeeds = canViewFamilies || isSecurityOfficer;
  const canViewAids = canViewFamilies;
  const canViewTasks = isManager || isSecurity;
  const canViewStructure = isManager || isDelegate || isSecurityOfficer;
  const families = useListFamilies({ query: { queryKey: getListFamiliesQueryKey(), enabled: canViewFamilies } });
  const needs = useListNeeds({ query: { queryKey: getListNeedsQueryKey(), enabled: canViewNeeds } });
  const aids = useListAids({ query: { queryKey: getListAidsQueryKey(), enabled: canViewAids } });
  const tasks = useListTasks({ query: { queryKey: getListTasksQueryKey(), enabled: canViewTasks } });
  const camps = useListCamps({ query: { queryKey: getListCampsQueryKey(), enabled: canViewStructure } });
  const sectors = useListSectors({ query: { queryKey: getListSectorsQueryKey(), enabled: canViewStructure } });

  const isLoading = (canViewFamilies && families.isLoading) || (canViewNeeds && needs.isLoading) ||
    (canViewAids && aids.isLoading) || (canViewTasks && tasks.isLoading) ||
    (canViewStructure && (camps.isLoading || sectors.isLoading));
  const isError = (canViewFamilies && families.isError) || (canViewNeeds && needs.isError) ||
    (canViewAids && aids.isError) || (canViewTasks && tasks.isError) ||
    (canViewStructure && (camps.isError || sectors.isError));

  if (isLoading) return <LoadingState message="إعداد التقارير والإحصائيات..." />;
  if (isError) return <ErrorState message="تعذر تحميل بعض البيانات الخاصة بالتقارير." />;

  const stats = [
    { label: 'إجمالي الأسر', value: families.data?.length ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'إجمالي الاحتياجات', value: needs.data?.length ?? 0, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'أنواع المساعدات', value: aids.data?.length ?? 0, icon: Package, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'مهام قيد التنفيذ', value: tasks.data?.filter((t: any) => t.status === 'IN_PROGRESS' || t.status === 'PENDING').length ?? 0, icon: CheckSquare, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'المخيمات', value: camps.data?.length ?? 0, icon: Map, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'القطاعات', value: sectors.data?.length ?? 0, icon: Home, color: 'text-teal-600', bg: 'bg-teal-100' },
  ];

  const needsFulfilled = needs.data?.filter((n: any) => n.status === 'FULFILLED').length ?? 0;
  const needsTotal = needs.data?.length ?? 0;
  const fulfillmentRate = needsTotal > 0 ? Math.round((needsFulfilled / needsTotal) * 100) : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">التقارير والإحصائيات</h1>
        <p className="text-muted-foreground mt-2">مؤشرات الأداء التشغيلي ومعلومات الملخص الشامل للمخيم.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-right">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
                <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="size-5 text-primary" />
              مؤشر تلبية الاحتياجات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000"
                  style={{ width: `${fulfillmentRate}%` }}
                />
              </div>
              <span className="font-bold text-lg text-primary min-w-[3rem] text-left">{fulfillmentRate}%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              تم تلبية {needsFulfilled} من أصل {needsTotal} احتياج مسجل في النظام.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
