import { useListFamilies, useListNeeds, useListTasks, getListFamiliesQueryKey, getListNeedsQueryKey, getListTasksQueryKey } from '@workspace/api-client-react';
import useAuth from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Labels } from '../shared/labels';
import { User, Mail, Phone, Shield, Users, ClipboardList, CheckSquare } from 'lucide-react';

export default function ProfileSection() {
  const { user, role, isManager, isDelegate, isSecurity, isSecurityOfficer } = useAuth();
  
  const canManageFamilies = isManager || isDelegate;
  const canViewTasks = isSecurity;
  
  const families = useListFamilies({ query: { queryKey: getListFamiliesQueryKey(), enabled: canManageFamilies } });
  const needs = useListNeeds({ query: { queryKey: getListNeedsQueryKey(), enabled: canManageFamilies || isSecurityOfficer } });
  const tasks = useListTasks({ query: { queryKey: getListTasksQueryKey(), enabled: canViewTasks } });

  const familiesCount = families.data?.length ?? 0;
  const needsCount = needs.data?.length ?? 0;
  const tasksCount = tasks.data?.length ?? 0;
  const completedTasksCount = tasks.data?.filter((t: any) => t.status === 'COMPLETED').length ?? 0;

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">الملف الشخصي</h1>
        <p className="text-muted-foreground mt-2">نظرة عامة على هويتك وملخص نشاطك في المخيم.</p>
      </header>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-2 lg:col-span-1 border-primary/20 shadow-sm bg-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-4 shadow-inner">
                <User className="size-10" />
              </div>
              <h2 className="text-xl font-bold">{user?.name}</h2>
              <Badge variant="secondary" className="mt-2 text-sm">{Labels[role as string] ?? role ?? 'مستخدم'}</Badge>
              
              <div className="w-full mt-6 space-y-3 text-sm text-right">
                <div className="flex items-center gap-3 text-muted-foreground bg-white/50 p-2 rounded-md">
                  <Mail className="size-4" />
                  <span dir="ltr" className="text-foreground">{user?.email || 'غير متوفر'}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground bg-white/50 p-2 rounded-md">
                  <Phone className="size-4" />
                  <span dir="ltr" className="text-foreground">{user?.phone_number || 'غير متوفر'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            إحصائيات الصلاحية
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {canManageFamilies && (
              <Card>
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-4 bg-teal-100 text-teal-700 rounded-xl"><Users className="size-6" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الأسر (في نطاقك)</p>
                    <p className="text-2xl font-bold">{familiesCount}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {(canManageFamilies || isSecurityOfficer) && (
              <Card>
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-4 bg-amber-100 text-amber-700 rounded-xl"><ClipboardList className="size-6" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">الاحتياجات المسجلة</p>
                    <p className="text-2xl font-bold">{needsCount}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {canViewTasks && (
              <>
                <Card>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-4 bg-indigo-100 text-indigo-700 rounded-xl"><CheckSquare className="size-6" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">المهام المسندة</p>
                      <p className="text-2xl font-bold">{tasksCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-4 bg-emerald-100 text-emerald-700 rounded-xl"><CheckSquare className="size-6" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">المهام المنجزة</p>
                      <p className="text-2xl font-bold">{completedTasksCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
