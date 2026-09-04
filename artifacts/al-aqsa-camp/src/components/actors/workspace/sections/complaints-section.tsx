import React, { useState } from 'react';
import { useListComplaints, getListComplaintsQueryKey, useUpdateComplaintStatus } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Button, Card, Table, Text, Badge, ActionIcon, TextInput, Title, Select, Modal, Textarea } from '@mantine/core';
import { Search, ArrowRight, MessageSquareWarning, Filter, MessageCircle } from 'lucide-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useQueryClient } from '@tanstack/react-query';

dayjs.locale('ar');

const statusLabels: Record<string, string> = { OPEN: "جديدة", IN_REVIEW: "قيد المراجعة", RESOLVED: "محلولة", REJECTED: "مرفوضة" };
const statusColors: Record<string, string> = { OPEN: "orange", IN_REVIEW: "blue", RESOLVED: "teal", REJECTED: "gray" };

export default function ComplaintsSection({ params }: { params?: Record<string, string | undefined> }) {
  if (params?.id) {
    return <ComplaintDetail id={params.id} />;
  }
  return <ComplaintsList />;
}

function ComplaintsList() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const { data: complaints, isLoading, error } = useListComplaints({ 
    query: { queryKey: getListComplaintsQueryKey() } 
  });

  if (isLoading) return <LoadingState message="جاري تحميل الشكاوى..." />;
  if (error) return <ErrorState message="حدث خطأ أثناء تحميل البيانات." />;

  const filtered = (complaints || []).filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (search && !c.subject.includes(search) && !c.complainantName.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="text-3xl font-display text-primary">الشكاوى والمقترحات</Title>
          <Text className="text-muted-foreground mt-1">متابعة ومعالجة شكاوى النازحين</Text>
        </div>
      </div>

      <Card withBorder shadow="sm" radius="lg" className="overflow-hidden bg-white dark:bg-card">
        <div className="p-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-4">
          <TextInput
            placeholder="ابحث بموضوع الشكوى أو اسم المشتكي..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="flex-1 min-w-[200px]"
            radius="md"
          />
          <Select
            placeholder="تصفية حسب الحالة"
            data={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
            value={filterStatus}
            onChange={setFilterStatus}
            clearable
            radius="md"
            leftSection={<Filter size={16} />}
            className="w-48"
          />
        </div>

        <div className="overflow-x-auto">
          <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>الموضوع</Table.Th>
                <Table.Th>مقدم الشكوى</Table.Th>
                <Table.Th>تاريخ التقديم</Table.Th>
                <Table.Th>الحالة</Table.Th>
                <Table.Th className="text-left">الإجراءات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length > 0 ? (
                filtered.map((complaint) => (
                  <Table.Tr key={complaint.id} className="group">
                    <Table.Td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-600">
                          <MessageSquareWarning size={20} />
                        </div>
                        <Text fw={600} size="sm" className="max-w-[200px] truncate">{complaint.subject}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{complaint.complainantName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{dayjs(complaint.createdAt).format('DD MMM YYYY')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[complaint.status]} variant={complaint.status === 'OPEN' ? 'filled' : 'light'} size="sm">
                        {statusLabels[complaint.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td className="text-left">
                      <Button 
                        variant="light" 
                        color="primary" 
                        size="xs" 
                        radius="md"
                        onClick={() => setLocation(`~/actor/complaints/${complaint.id}`)}
                      >
                        معالجة
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5} className="text-center py-10">
                    <Text c="dimmed">لا توجد شكاوى تطابق بحثك.</Text>
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

function ComplaintDetail({ id }: { id: string }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState('');
  
  const { data: complaints, isLoading } = useListComplaints({ 
    query: { queryKey: getListComplaintsQueryKey() } 
  });
  
  const updateComplaint = useUpdateComplaintStatus();
  const complaint = (complaints || []).find(c => c.id === id);

  if (isLoading) return <LoadingState message="جاري تحميل التفاصيل..." />;
  if (!complaint) return <ErrorState message="تعذر العثور على الشكوى." />;

  const handleStatusUpdate = (status: string) => {
    updateComplaint.mutate({ 
      complaintId: id, 
      data: { status: status as any, expectedVersion: complaint.version, reply: replyText || complaint.reply } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <ActionIcon variant="light" size="lg" radius="md" onClick={() => setLocation('~/actor/complaints')}>
          <ArrowRight size={20} />
        </ActionIcon>
        <div>
          <Title order={3} className="text-2xl font-display text-primary">تفاصيل الشكوى</Title>
        </div>
      </div>

      <Card withBorder shadow="sm" radius="lg" p="xl" className="space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <Title order={2} className="mb-2 font-display">{complaint.subject}</Title>
            <div className="flex gap-2 mb-4">
              <Badge variant="outline" size="md">{complaint.complainantName}</Badge>
              <Badge variant="filled" color={statusColors[complaint.status]} size="md">{statusLabels[complaint.status]}</Badge>
            </div>
          </div>
          <Text size="sm" c="dimmed">{dayjs(complaint.createdAt).format('DD MMM YYYY HH:mm')}</Text>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-5 border border-border">
          <Text fw={600} className="mb-2 text-primary flex items-center gap-2">
            <MessageSquareWarning size={18} />
            نص الشكوى:
          </Text>
          <Text className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{complaint.description}</Text>
          
          {complaint.location && (
            <Text size="sm" className="mt-4 text-slate-500">الموقع المسجل: {complaint.location}</Text>
          )}
        </div>
        
        <div className="border-t border-border pt-6 space-y-4">
          <Title order={4} className="font-display text-sidebar flex items-center gap-2">
            <MessageCircle size={18} />
            الرد والمعالجة
          </Title>
          
          <Textarea 
            placeholder="اكتب ردك أو الإجراء الذي تم اتخاذه..." 
            value={replyText || complaint.reply || ''} 
            onChange={(e) => setReplyText(e.currentTarget.value)}
            minRows={4}
            disabled={complaint.status === 'RESOLVED'}
          />
          
          {complaint.status !== 'RESOLVED' && (
            <div className="flex flex-wrap gap-3 pt-2">
              <Button color="blue" onClick={() => handleStatusUpdate('IN_REVIEW')} disabled={complaint.status === 'IN_REVIEW'}>
                تغيير إلى قيد المراجعة
              </Button>
              <Button color="teal" onClick={() => handleStatusUpdate('RESOLVED')} disabled={!replyText && !complaint.reply}>
                إغلاق كـ محلولة
              </Button>
              <Button variant="light" color="gray" onClick={() => handleStatusUpdate('REJECTED')}>
                رفض الشكوى
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}