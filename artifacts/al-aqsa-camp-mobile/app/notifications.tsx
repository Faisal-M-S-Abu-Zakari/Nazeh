import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, ScrollView, Text, Pressable, ActivityIndicator } from 'react-native';
import { ScreenHeader, Card, fonts } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useListNotifications, useMarkNotificationRead, getListNotificationsQueryKey } from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';
import { useQueryClient } from '@tanstack/react-query';

export default function NotificationsScreen() {
  const colors = useColors();
  const { signedIn } = useApp();
  const queryClient = useQueryClient();

  const { data: notifPage, isLoading, isError, refetch } = useListNotifications(undefined, {
    query: { enabled: signedIn, queryKey: getListNotificationsQueryKey() }
  });

  const notifications = notifPage?.items || [];

  const markReadMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    }
  });

  const handlePress = (id: number, read: boolean) => {
    if (!read) {
      markReadMutation.mutate({ id, data: { read: true } });
    }
  };

  if (!signedIn) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="الإشعارات" />
        <View style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>يرجى تسجيل الدخول لعرض الإشعارات.</Text></View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader 
        title="الإشعارات" 
        subtitle="أحدث التنبيهات والتحديثات" 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
        
        {isError && (
          <Card style={styles.center}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>تعذر جلب الإشعارات.</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text>
            </Pressable>
          </Card>
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <Card style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد إشعارات حالياً.</Text>
          </Card>
        )}

        {!isLoading && !isError && notifications.map(notif => (
          <Pressable key={notif.id} onPress={() => handlePress(notif.id, notif.read)}>
            <Card style={[styles.card, !notif.read && { backgroundColor: colors.accent, borderColor: colors.primary }]}>
              <View style={styles.headerRow}>
                {!notif.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                <Text style={[styles.title, { color: colors.foreground }]}>{notif.title}</Text>
              </View>
              <Text style={[styles.message, { color: colors.foreground }]}>{notif.message}</Text>
              <Text style={[styles.date, { color: colors.mutedForeground }]}>{new Date(notif.createdAt).toLocaleDateString('ar')}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { padding: 16 },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, textAlign: 'right', marginBottom: 12 },
  date: { fontFamily: fonts.medium, fontSize: 12, textAlign: 'right' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center' },
});