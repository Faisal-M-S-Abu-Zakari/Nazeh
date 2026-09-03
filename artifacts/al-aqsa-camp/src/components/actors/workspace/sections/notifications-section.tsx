import React from 'react';
import { useListNotifications, getListNotificationsQueryKey, useMarkNotificationRead } from '@workspace/api-client-react';
import { Card, Title, Text, ActionIcon, Badge, Button } from '@mantine/core';
import { Bell, CheckCircle2 } from 'lucide-react';
import { LoadingState, ErrorState } from '../shared/ui-states';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useQueryClient } from '@tanstack/react-query';

dayjs.locale('ar');

export default function NotificationsSection({ params }: { params?: Record<string, string | undefined> }) {
  const queryClient = useQueryClient();
  const { data: page, isLoading, error } = useListNotifications({ limit: 50 }, { 
    query: { queryKey: getListNotificationsQueryKey({ limit: 50 }) } 
  });
  
  const markRead = useMarkNotificationRead();

  if (isLoading) return <LoadingState message="جاري تحميل الإشعارات..." />;
  if (error) return <ErrorState message="حدث خطأ في تحميل التنبيهات." />;

  const notifications = page?.items || [];

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id, data: { read: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div className="mb-6">
        <Title order={2} className="text-3xl font-display text-primary flex items-center gap-3">
          <Bell size={28} />
          الإشعارات والتنبيهات
        </Title>
        <Text className="text-muted-foreground mt-1">تابع أحدث التنبيهات الخاصة بحسابك</Text>
      </div>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <Card 
              key={notification.id} 
              withBorder 
              shadow="sm" 
              radius="lg" 
              className={`transition-colors ${notification.read ? 'bg-slate-50/50 dark:bg-card/50' : 'border-primary/50 bg-white dark:bg-card'}`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {!notification.read && <div className="w-2 h-2 rounded-full bg-primary" />}
                    <Text fw={700} className={notification.read ? 'text-slate-600' : 'text-primary'}>
                      {notification.title}
                    </Text>
                  </div>
                  <Text size="sm" className="text-muted-foreground pr-4">
                    {notification.message}
                  </Text>
                  <Text size="xs" c="dimmed" className="mt-2 pr-4">
                    {dayjs(notification.createdAt).format('DD MMMM YYYY - HH:mm')}
                  </Text>
                </div>
                
                {!notification.read && (
                  <Button 
                    variant="subtle" 
                    color="teal" 
                    size="xs" 
                    leftSection={<CheckCircle2 size={14} />}
                    onClick={() => handleMarkRead(notification.id)}
                    loading={markRead.isPending}
                  >
                    تحديد كمقروء
                  </Button>
                )}
              </div>
            </Card>
          ))
        ) : (
          <Card withBorder radius="lg" className="py-12 text-center text-muted-foreground">
            <Bell size={48} className="mx-auto text-slate-200 mb-4" />
            <Text>لا توجد إشعارات حالياً.</Text>
          </Card>
        )}
      </div>
    </div>
  );
}