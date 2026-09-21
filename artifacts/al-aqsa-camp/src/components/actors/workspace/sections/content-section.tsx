import React, { useState } from 'react';
import { useListContent, getListContentQueryKey, useCreateContentPost, useUpdateContentPost } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Button, Card, Table, Text, Badge, ActionIcon, TextInput, Title, Select, Modal, Textarea } from '@mantine/core';
import { Search, ArrowRight, FileText, Plus, Eye, CheckCircle } from 'lucide-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useQueryClient } from '@tanstack/react-query';

dayjs.locale('ar');

const statusLabels: Record<string, string> = { draft: "مسودة", published: "منشور" };
const statusColors: Record<string, string> = { draft: "orange", published: "teal" };

export default function ContentSection({ params }: { params?: Record<string, string | undefined> }) {
  if (params?.id === 'new') {
    return <ContentForm />;
  }

  if (params?.id) {
    return <ContentDetail id={Number(params.id)} />;
  }

  return <ContentList />;
}

function ContentList() {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useLocation();
  const { data: page, isLoading, error } = useListContent({ limit: 50 }, { 
    query: { queryKey: getListContentQueryKey({ limit: 50 }) } 
  });

  if (isLoading) return <LoadingState message="جاري تحميل المحتوى..." />;
  if (error) return <ErrorState message="حدث خطأ أثناء تحميل البيانات." />;

  const posts = page?.items || [];
  const filtered = posts.filter(p => p.title.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="text-3xl font-display text-primary">إدارة المحتوى</Title>
          <Text className="text-muted-foreground mt-1">نشر الأخبار والتقارير الميدانية وقصص النجاح</Text>
        </div>
        <Link href="/actor/content/new" className="no-underline">
          <Button leftSection={<Plus size={18} />} size="md" radius="md" className="bg-primary hover:bg-primary/90">
            إضافة محتوى جديد
          </Button>
        </Link>
      </div>

      <Card withBorder shadow="sm" radius="lg" className="overflow-hidden bg-white dark:bg-card">
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-4">
          <TextInput
            placeholder="ابحث بعنوان المقال أو التقرير..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="flex-1 max-w-md"
            radius="md"
          />
        </div>

        <div className="overflow-x-auto">
          <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>العنوان</Table.Th>
                <Table.Th>الحالة</Table.Th>
                <Table.Th>تاريخ الإنشاء</Table.Th>
                <Table.Th>تاريخ النشر</Table.Th>
                <Table.Th className="text-left">الإجراءات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length > 0 ? (
                filtered.map((post) => (
                  <Table.Tr key={post.id} className="group">
                    <Table.Td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary">
                          <FileText size={20} />
                        </div>
                        <Text fw={600} size="sm" className="max-w-[250px] truncate">{post.title}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[post.status]} variant={post.status === 'published' ? 'filled' : 'light'} size="sm">
                        {statusLabels[post.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{dayjs(post.createdAt).format('DD MMM YYYY')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{post.publishedAt ? dayjs(post.publishedAt).format('DD MMM YYYY') : '-'}</Text>
                    </Table.Td>
                    <Table.Td className="text-left">
                      <Button 
                        variant="light" 
                        color="primary" 
                        size="xs" 
                        radius="md"
                        onClick={() => setLocation(`/actor/content/${post.id}`)}
                      >
                        معاينة وتعديل
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5} className="text-center py-10">
                    <Text c="dimmed">لا يوجد محتوى مسجل.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function ContentDetail({ id }: { id: number }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: page, isLoading } = useListContent({ limit: 100 }, { 
    query: { queryKey: getListContentQueryKey({ limit: 100 }) } 
  });
  
  const updateContent = useUpdateContentPost();
  const post = page?.items.find(p => p.id === id);

  if (isLoading) return <LoadingState message="جاري تحميل المحتوى..." />;
  if (!post) return <ErrorState message="تعذر العثور على المحتوى." />;

  const handlePublish = () => {
    updateContent.mutate({
      id,
      data: { status: 'published' }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/actor/content')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <div>
          <Title order={3} className="text-2xl font-display text-primary">معاينة المحتوى</Title>
        </div>
      </div>

      <Card withBorder shadow="sm" radius="lg" p={0} className="overflow-hidden space-y-6">
        {post.imageUrl && (
          <div className="w-full h-64 sm:h-80 bg-slate-200">
            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-start mb-6 border-b border-border pb-6">
            <div>
              <Title order={2} className="mb-2 font-display leading-relaxed">{post.title}</Title>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>تاريخ الإنشاء: {dayjs(post.createdAt).format('DD MMM YYYY')}</span>
                {post.publishedAt && <span>النشر: {dayjs(post.publishedAt).format('DD MMM YYYY')}</span>}
              </div>
            </div>
            <Badge variant="filled" color={statusColors[post.status]} size="lg">
              {statusLabels[post.status]}
            </Badge>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none mb-8 whitespace-pre-wrap">
            {post.body}
          </div>
          
          {post.status === 'draft' && (
            <div className="pt-6 border-t border-border flex justify-end">
              <Button color="teal" leftSection={<CheckCircle size={18} />} onClick={handlePublish} loading={updateContent.isPending}>
                نشر المحتوى
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ContentForm() {
  const [location, setLocation] = useLocation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  const createContent = useCreateContentPost();
  const queryClient = useQueryClient();

  const handleSubmit = (status: 'draft' | 'published') => {
    if (!title || !body) return;
    createContent.mutate({
      data: { title, body, imageUrl, status }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
        setLocation('/actor/content');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('/actor/content')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <Title order={2} className="text-3xl font-display text-primary">إضافة محتوى جديد</Title>
      </div>
      
      <Card withBorder shadow="sm" radius="lg" p="xl" className="space-y-6">
         <TextInput 
           label="العنوان" 
           placeholder="عنوان المقال أو التقرير الميداني" 
           required 
           value={title}
           onChange={(e) => setTitle(e.currentTarget.value)}
           size="lg"
         />
         
         <TextInput 
           label="رابط الصورة (اختياري)" 
           placeholder="https://..." 
           value={imageUrl}
           onChange={(e) => setImageUrl(e.currentTarget.value)}
           dir="ltr"
           className="text-right"
         />
         
         <Textarea 
           label="محتوى المقال" 
           placeholder="اكتب النص هنا..." 
           minRows={10} 
           required
           value={body}
           onChange={(e) => setBody(e.currentTarget.value)}
         />
         
         <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
          <Button variant="outline" color="gray" onClick={() => setLocation('/actor/content')} radius="md">
            إلغاء
          </Button>
          <Button variant="light" color="orange" onClick={() => handleSubmit('draft')} disabled={!title || !body || createContent.isPending}>
            حفظ كمسودة
          </Button>
          <Button className="bg-primary hover:bg-primary/90" radius="md" onClick={() => handleSubmit('published')} disabled={!title || !body || createContent.isPending} loading={createContent.isPending}>
            نشر الآن
          </Button>
        </div>
      </Card>
    </div>
  );
}