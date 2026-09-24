import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from 'react-native';
import { ScreenHeader, Card, fonts, StatusPill } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useListNeeds, getListNeedsQueryKey } from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';

export default function NeedsScreen() {
  const colors = useColors();
  const { user, canManagePeople } = useApp();
  const canReadNeeds = canManagePeople || user?.role === 'SECURITY_OFFICER';
  
  const { data: needsPage, isLoading, isError, refetch } = useListNeeds({
    query: { enabled: canReadNeeds, queryKey: getListNeedsQueryKey() }
  });

  const needs = needsPage || [];

  const getStatusText = (status: string) => {
    switch(status) {
      case 'REQUIRED': return 'مطلوب';
      case 'APPROVED': return 'موافق عليه';
      case 'IN_PROGRESS': return 'جاري التنفيذ';
      case 'FULFILLED': return 'مكتمل';
      case 'CANCELLED': return 'ملغى';
      default: return status;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'FOOD': return 'restaurant-outline';
      case 'MEDICAL': return 'medkit-outline';
      case 'SHELTER': return 'home-outline';
      case 'WATER': return 'water-outline';
      case 'HYGIENE': return 'body-outline';
      default: return 'cube-outline';
    }
  };

  if (!canReadNeeds) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="الاحتياجات" subtitle="طلبات واحتياجات العائلات" />
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>ليس لديك صلاحية لعرض الاحتياجات.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader 
        title="الاحتياجات" 
        subtitle="طلبات واحتياجات العائلات" 
        action={canManagePeople ? (
          <Pressable accessibilityRole="button" accessibilityLabel="إضافة احتياج" onPress={() => router.push('/need-form' as never)}>
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </Pressable>
        ) : undefined}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
        
        {isError && (
          <Card style={styles.center}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>تعذر جلب بيانات الاحتياجات.</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text>
            </Pressable>
          </Card>
        )}

        {!isLoading && !isError && needs.length === 0 && (
          <Card style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد احتياجات مسجلة.</Text>
          </Card>
        )}

        {!isLoading && !isError && needs.map(need => (
          <Pressable key={need.id} onPress={() => router.push(`/need/${need.id}` as never)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <StatusPill text={getStatusText(need.status)} tone={need.status === 'FULFILLED' ? 'green' : 'gold'} />
                <View style={styles.contentArea}>
                  <Text style={[styles.title, { color: colors.foreground }]}>{need.title}</Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>{new Date(need.createdAt).toLocaleDateString('ar')}</Text>
                </View>
                <View style={[styles.iconBox, { backgroundColor: colors.accent }]}>
                  <Ionicons name={getCategoryIcon(need.category) as any} size={24} color={colors.primary} />
                </View>
              </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contentArea: { flex: 1, alignItems: 'flex-end' },
  title: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
  meta: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center' },
});