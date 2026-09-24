import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { ScreenHeader, Card, fonts, StatusPill } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useListFamilies, getListFamiliesQueryKey } from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';

export default function FamiliesScreen() {
  const colors = useColors();
  const { canManagePeople, signedIn } = useApp();
  const { data: familyPage, isLoading, isFetching, isError, refetch } = useListFamilies({
    query: { enabled: signedIn && canManagePeople, queryKey: getListFamiliesQueryKey() }
  });

  const families = familyPage || [];

  if (!signedIn || !canManagePeople) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="العائلات" subtitle="إدارة سجل العائلات" />
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>ليس لديك صلاحية لعرض العائلات.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader 
        title="العائلات" 
        subtitle="إدارة سجل العائلات" 
        action={
          <Pressable onPress={() => router.push('/family-form' as never)}>
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={colors.primary} />}
      >
        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
        
        {isError && (
          <Card style={styles.center}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>حدث خطأ أثناء جلب البيانات.</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text>
            </Pressable>
          </Card>
        )}

        {!isLoading && !isError && families.length === 0 && (
          <Card style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد عائلات مسجلة.</Text>
            <Pressable onPress={() => router.push('/family-form' as never)} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>أضف عائلة جديدة</Text>
            </Pressable>
          </Card>
        )}

        {!isLoading && !isError && families.map(family => (
          <Pressable key={family.id} onPress={() => router.push(`/family/${family.id}` as never)}>
            <Card style={styles.card}>
              <View style={styles.header}>
                <StatusPill text={family.status === 'ACTIVE' ? 'نشطة' : family.status === 'PENDING_APPROVAL' ? 'بانتظار الموافقة' : 'مؤرشفة'} tone={family.status === 'ACTIVE' ? 'green' : family.status === 'PENDING_APPROVAL' ? 'gold' : 'red'} />
                <Text style={[styles.title, { color: colors.foreground }]}>{family.headName}</Text>
              </View>
              <View style={styles.details}>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>{family.headPhone || 'لا يوجد هاتف'} • {new Date(family.createdAt).toLocaleDateString('ar')}</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 18 },
  details: { marginTop: 12, alignItems: 'flex-end' },
  meta: { fontFamily: fonts.regular, fontSize: 14 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center' },
});