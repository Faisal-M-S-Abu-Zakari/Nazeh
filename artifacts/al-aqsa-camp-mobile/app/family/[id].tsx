import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet, ScrollView, Text, Pressable, ActivityIndicator } from 'react-native';
import { ScreenHeader, Card, fonts, StatusPill, PrimaryButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useGetFamily, getGetFamilyQueryKey } from '@workspace/api-client-react';

export default function FamilyScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canManagePeople } = useApp();

  const { data: family, isLoading, isError } = useGetFamily(id as string, {
    query: { enabled: !!id && canManagePeople, queryKey: getGetFamilyQueryKey(id as string) }
  });

  if (!canManagePeople) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="تفاصيل العائلة" />
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>ليس لديك صلاحية لعرض العائلات.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader 
        title="تفاصيل العائلة" 
        action={
          canManagePeople && family ? (
            <Pressable onPress={() => router.push(`/family-form?id=${id}` as never)}>
              <Ionicons name="create-outline" size={26} color={colors.primary} />
            </Pressable>
          ) : undefined
        }
      />
      
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
        
        {isError && (
          <Card style={styles.center}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>تعذر جلب تفاصيل العائلة.</Text>
          </Card>
        )}

        {family && (
          <>
            <Card style={styles.headerCard}>
              <View style={styles.headerTitleRow}>
                <StatusPill text={family.status === 'ACTIVE' ? 'نشطة' : family.status === 'PENDING_APPROVAL' ? 'بانتظار الموافقة' : 'مؤرشفة'} tone={family.status === 'ACTIVE' ? 'green' : family.status === 'PENDING_APPROVAL' ? 'gold' : 'red'} />
                <Text style={[styles.headName, { color: colors.foreground }]}>{family.headName}</Text>
              </View>
              
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>رقم الجوال</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{family.headPhone || 'لا يوجد'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>تاريخ الإضافة</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{new Date(family.createdAt).toLocaleDateString('ar')}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>ملاحظات الإيواء</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{family.criticalNotes || 'لا يوجد'}</Text>
                </View>
              </View>
            </Card>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>أفراد العائلة ({family.members.length})</Text>
              <Ionicons name="people-outline" size={22} color={colors.primary} />
            </View>

            {family.members.length === 0 ? (
               <Card style={styles.center}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا يوجد أفراد مسجلين.</Text>
               </Card>
            ) : (
              family.members.map(member => (
                <Card key={member.id} style={styles.memberCard}>
                  <View style={styles.memberRow}>
                    <View style={[styles.memberBadge, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.memberRelationship, { color: colors.primary }]}>{member.relationship}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: colors.foreground }]}>{member.fullName}</Text>
                      <Text style={[styles.memberDetails, { color: colors.mutedForeground }]}>
                        {member.gender === 'MALE' ? 'ذكر' : member.gender === 'FEMALE' ? 'أنثى' : 'آخر'}
                        {member.birthDate ? ` • ${new Date(member.birthDate).toLocaleDateString('ar')}` : ''}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}

            {canManagePeople && (
              <View style={styles.actions}>
                <PrimaryButton 
                  label="تعديل بيانات العائلة" 
                  icon="pencil" 
                  onPress={() => router.push(`/family-form?id=${id}` as never)} 
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  headerCard: { padding: 20 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headName: { fontFamily: fonts.extraBold, fontSize: 22 },
  infoGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 16 },
  infoItem: { minWidth: '45%', alignItems: 'flex-end' },
  infoLabel: { fontFamily: fonts.medium, fontSize: 13, marginBottom: 4 },
  infoValue: { fontFamily: fonts.bold, fontSize: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18 },
  memberCard: { padding: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberInfo: { flex: 1, alignItems: 'flex-end', marginRight: 12 },
  memberName: { fontFamily: fonts.bold, fontSize: 16 },
  memberDetails: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  memberBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  memberRelationship: { fontFamily: fonts.bold, fontSize: 12 },
  actions: { marginTop: 16 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center' },
});