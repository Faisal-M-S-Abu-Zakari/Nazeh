import { useState, useMemo } from 'react';
import { useListAids, getListAidsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState, EmptyState } from '../shared/ui-states';
import { Search, Package, PackageOpen } from 'lucide-react';

export default function AidsSection() {
  const [search, setSearch] = useState('');
  
  const aids = useListAids({ query: { queryKey: getListAidsQueryKey() } });

  const filteredAids = useMemo(() => {
    if (!aids.data) return [];
    return aids.data.filter((aid: any) => {
      return aid.title?.toLowerCase().includes(search.toLowerCase()) || 
             aid.type?.toLowerCase().includes(search.toLowerCase());
    });
  }, [aids.data, search]);

  if (aids.isLoading) return <LoadingState message="تحميل سجل المساعدات..." />;
  if (aids.isError) return <ErrorState message="حدث خطأ أثناء جلب المساعدات." />;

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">مخزون المساعدات</h1>
        <p className="text-muted-foreground mt-2">نظرة عامة على المساعدات المتوفرة وقيد التوزيع.</p>
      </header>

      <div className="relative max-w-md mb-6">
        <Search className="absolute right-3 top-2.5 size-5 text-muted-foreground" />
        <Input 
          className="pr-10" 
          placeholder="بحث في المساعدات (العنوان، النوع)..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {filteredAids.length === 0 ? (
        <EmptyState title="لا توجد مساعدات" description="لم يتم العثور على مساعدات تطابق معايير البحث." icon={PackageOpen} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAids.map((aid: any) => (
            <Card key={aid.id} className="transition-all hover:shadow-md border-l-4 border-l-primary">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Package className="size-5" />
                  </div>
                  <Badge variant="outline">{aid.type ?? 'عام'}</Badge>
                </div>
                <h3 className="font-bold text-lg mb-1">{aid.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
                  {aid.description || 'لا يوجد وصف متاح.'}
                </p>
                <div className="pt-4 border-t flex justify-between items-center text-sm font-medium">
                  <span className="text-muted-foreground">الكمية المتاحة:</span>
                  <span className="text-xl text-primary font-bold">{aid.quantity} <span className="text-sm font-normal text-muted-foreground">{aid.unit}</span></span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
