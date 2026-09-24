import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, ScrollView, Text, ActivityIndicator, Pressable } from 'react-native';
import { ScreenHeader, Card, fonts } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useGetDashboard, getGetDashboardQueryKey } from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';

export default function ReportsScreen() {
  const colors = useColors();
  const { user, signedIn } = useApp();
  
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  
  const { data: dashboard, isLoading, isError, refetch } = useGetDashboard({
    query: { enabled: isManager, queryKey: getGetDashboardQueryKey() }
  });

  if (!signedIn || !isManager) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="التقارير والإحصائيات" />
        <View style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>هذه الصفحة مخصصة لمدراء النظام فقط.</Text></View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader 
        title="التقارير والإحصائيات" 
        subtitle="نظرة عامة على عمليات المخيم" 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
        
        {isError && (
          <Card style={styles.center}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>تعذر جلب بيانات التقارير.</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text>
            </Pressable>
          </Card>
        )}

        {!isLoading && !isError && dashboard && (
          <View style={styles.grid}>
            <Card style={styles.gridCard}>
              <Ionicons name="people" size={32} color={colors.primary} />
              <Text style={[styles.number, { color: colors.foreground }]}>{dashboard.totalDisplacedPersons}</Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>إجمالي الأفراد</Text>
            </Card>
            <Card style={styles.gridCard}>
              <Ionicons name="people-circle" size={32} color={colors.primary} />
              <Text style={[styles.number, { color: colors.foreground }]}>{dashboard.totalDelegates}</Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>المندوبين</Text>
            </Card>
            <Card style={styles.gridCard}>
              <Ionicons name="cube" size={32} color={colors.primary} />
              <Text style={[styles.number, { color: colors.foreground }]}>{dashboard.activeAids}</Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>حملات نشطة</Text>
            </Card>
            <Card style={styles.gridCard}>
              <Ionicons name="chatbubbles" size={32} color={colors.primary} />
              <Text style={[styles.number, { color: colors.foreground }]}>{dashboard.openComplaints}</Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>شكاوى مفتوحة</Text>
            </Card>
            <Card style={styles.gridCard}>
              <Ionicons name="notifications" size={32} color={colors.primary} />
              <Text style={[styles.number, { color: colors.foreground }]}>{dashboard.unreadNotifications}</Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>إشعارات غير مقروءة</Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 16 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  gridCard: { width: '48%', padding: 20, alignItems: 'center', gap: 8 },
  number: { fontFamily: fonts.extraBold, fontSize: 28 },
  label: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
});