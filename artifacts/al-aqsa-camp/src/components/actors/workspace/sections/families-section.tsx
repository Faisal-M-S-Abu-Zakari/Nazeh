import { useState, useMemo } from 'react';
import { useListFamilies, getListFamiliesQueryKey, useListSectors, getListSectorsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Labels, StatusVariant } from '../shared/labels';
import { LoadingState, ErrorState, EmptyState } from '../shared/ui-states';
import { Search, Users, MapPin } from 'lucide-react';

export default function FamiliesSection() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const families = useListFamilies({ query: { queryKey: getListFamiliesQueryKey() } });
  const sectors = useListSectors({ query: { queryKey: getListSectorsQueryKey() } });

  const filteredFamilies = useMemo(() => {
    if (!families.data) return [];
    return families.data.filter((family: any) => {
      const matchSearch = `${family.headName} ${family.id}`.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter ? family.status === statusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [families.data, search, statusFilter]);

  const getSectorName = (id: string) => sectors.data?.find((s: any) => s.id === id)?.name ?? 'قطاع غير معروف';

  if (families.isLoading || sectors.isLoading) return <LoadingState message="تحميل سجل الأسر..." />;
  if (families.isError) return <ErrorState message="حدث خطأ أثناء جلب الأسر." />;

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">سجل الأسر</h1>
        <p className="text-muted-foreground mt-2">إدارة ومتابعة الأسر المسجلة في القطاعات التابعة لك.</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 size-5 text-muted-foreground" />
          <Input 
            className="pr-10" 
            placeholder="بحث باسم رب الأسرة أو المعرّف..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <select 
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">جميع الحالات</option>
          <option value="ACTIVE">نشطة</option>
          <option value="PENDING_APPROVAL">بانتظار الاعتماد</option>
          <option value="ARCHIVED">مؤرشفة</option>
        </select>
      </div>

      {filteredFamilies.length === 0 ? (
        <EmptyState title="لا توجد أسر" description="لم يتم العثور على أسر تطابق معايير البحث." icon={Users} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFamilies.map((family: any) => (
            <Card key={family.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardContent className="p-0">
                <div className="p-5 border-b bg-muted/10 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{family.headName}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">#{family.id.slice(0, 8)}</p>
                  </div>
                  <Badge variant={StatusVariant(family.status) as any}>{Labels[family.status] ?? family.status}</Badge>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4" />
                    <span>{getSectorName(family.sectorId)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="size-4" />
                    <span>الإصدار الحالي: {family.version ?? 1}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
