import React from 'react';
import { Card, Title, Text, SimpleGrid, Group, RingProgress, Badge } from '@mantine/core';
import { useGetDashboard, getGetDashboardQueryKey } from '@workspace/api-client-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import { Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function ReportsSection({ params }: { params?: Record<string, string | undefined> }) {
  const { data: dashboard, isLoading, error } = useGetDashboard({ 
    query: { queryKey: getGetDashboardQueryKey() } 
  });

  if (isLoading) return <LoadingState message="جاري إعداد التقرير الإحصائي..." />;
  if (error || !dashboard) return <ErrorState message="حدث خطأ في تحميل التقارير." />;

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <Title order={2} className="text-3xl font-display text-primary">التقارير والإحصائيات</Title>
        <Text className="text-muted-foreground mt-1">نظرة عامة على أداء ومؤشرات المخيم</Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        <StatCard title="إجمالي النازحين" value={dashboard.totalDisplacedPersons} icon={<Users size={24} />} color="teal" />
        <StatCard title="المندوبين الميدانيين" value={dashboard.totalDelegates} icon={<CheckCircle size={24} />} color="blue" />
        <StatCard title="المساعدات النشطة" value={dashboard.activeAids} icon={<Clock size={24} />} color="orange" />
        <StatCard title="الشكاوى المفتوحة" value={dashboard.openComplaints} icon={<AlertTriangle size={24} />} color="red" />
      </SimpleGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card withBorder shadow="sm" radius="lg" p="xl" className="flex flex-col items-center justify-center">
          <Title order={4} className="font-display self-start w-full mb-6">حالة الموارد الإغاثية</Title>
          <Group justify="center">
            <RingProgress
              size={180}
              thickness={16}
              roundCaps
              sections={[
                { value: 40, color: 'teal', tooltip: 'غذاء' },
                { value: 25, color: 'blue', tooltip: 'ماء' },
                { value: 15, color: 'red', tooltip: 'علاج' },
              ]}
              label={
                <Text ta="center" size="lg" fw={700} className="font-display">
                  مستقرة
                </Text>
              }
            />
          </Group>
          <div className="flex gap-4 mt-6">
             <Badge color="teal" variant="dot">غذاء (40%)</Badge>
             <Badge color="blue" variant="dot">ماء (25%)</Badge>
             <Badge color="red" variant="dot">علاج (15%)</Badge>
          </div>
        </Card>

        <Card withBorder shadow="sm" radius="lg" p="xl">
          <Title order={4} className="font-display mb-6">أحدث التنبيهات</Title>
          <div className="space-y-4">
             {dashboard.unreadNotifications > 0 ? (
               <div className="p-4 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
                 <AlertTriangle className="text-red-500 mt-1" size={20} />
                 <div>
                   <Text fw={600} className="text-red-700">لديك {dashboard.unreadNotifications} إشعار غير مقروء</Text>
                   <Text size="sm" className="text-red-600/80">يرجى مراجعة صندوق الإشعارات للأهمية.</Text>
                 </div>
               </div>
             ) : (
               <div className="p-4 rounded-lg bg-teal-50 border border-teal-100 flex items-start gap-3">
                 <CheckCircle className="text-teal-500 mt-1" size={20} />
                 <div>
                   <Text fw={600} className="text-teal-700">الوضع مستقر</Text>
                   <Text size="sm" className="text-teal-600/80">تمت قراءة جميع التنبيهات والإشعارات.</Text>
                 </div>
               </div>
             )}
             
             <div className="p-4 rounded-lg border border-border bg-slate-50">
                <Text fw={600} className="text-slate-700 mb-1">الشكاوى تتطلب تدخلاً</Text>
                <Text size="sm" className="text-slate-600">هناك {dashboard.openComplaints} شكوى مفتوحة تنتظر المراجعة والتوجيه من قِبل المشرفين.</Text>
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card withBorder shadow="sm" radius="lg" p="lg" className="hover:shadow-md transition-shadow">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="sm" fw={500} className="text-muted-foreground mb-2">{title}</Text>
          <Text className="text-3xl font-display font-bold">{value}</Text>
        </div>
        <div className={`p-3 rounded-xl bg-${color}-100 text-${color}-600`}>
          {icon}
        </div>
      </Group>
    </Card>
  );
}