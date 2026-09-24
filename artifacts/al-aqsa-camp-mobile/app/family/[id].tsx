import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet, ScrollView, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { ScreenHeader, Card, fonts, StatusPill, PrimaryButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import {
  approveFamily, archiveFamily, useGetFamily, getGetFamilyQueryKey, getListFamiliesQueryKey,
  useApproveFamily, useArchiveFamily,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getErrorStatus } from '@/lib/mutationErrors';

function getFamilyErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return 'لا تملك الصلاحية لتنفيذ هذا الإجراء.';
  if (status === 404) return 'لم تعد العائلة متاحة. حدّث البيانات ثم حاول مرة أخرى.';
  if (status === 409) return 'تغيّرت بيانات العائلة. أعد تحميلها ثم حاول مرة أخرى.';
  if (status !== undefined && status >= 500) return 'تعذر الاتصال بالخادم. لم يُحفظ التغيير؛ حاول مرة أخرى.';
  return 'لم يُحفظ التغيير. حاول مرة أخرى.';
}

export default function FamilyScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canManagePeople, signedIn, user } = useApp();
  const canReviewFamilies = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data: family, isLoading, isError, refetch } = useGetFamily(id as string, {
    query: { enabled: !!id && canManagePeople, queryKey: getGetFamilyQueryKey(id as string) }
  });

  const refreshFamilyData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetFamilyQueryKey(id as string) }),
      queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() }),
    ]);
    await refetch();
  };
  const handleMutationError = async (error: unknown) => {
    if (getErrorStatus(error) === 409) {
      try { await refreshFamilyData(); } catch { /* Keep the conflict message primary. */ }
    }
    Alert.alert(getErrorStatus(error) === 409 ? 'تعارض في تحديث العائلة' : 'تعذر تحديث العائلة', getFamilyErrorMessage(error));
  };
  const approveMutation = useApproveFamily({
    mutation: {
      mutationFn: ({ familyId, data }) => approveFamily(familyId, data, {
        headers: { 'Idempotency-Key': `mobile-family-approve-${Date.now()}-${Math.random().toString(36).slice(2)}` }
      }),
      onSuccess: () => { void refreshFamilyData(); },
      onError: (error) => { void handleMutationError(error); },
    }
  });
  const archiveMutation = useArchiveFamily({
    mutation: {
      mutationFn: ({ familyId, data }) => archiveFamily(familyId, data, {
        headers: { 'Idempotency-Key': `mobile-family-archive-${Date.now()}-${Math.random().toString(36).slice(2)}` }
      }),
      onSuccess: () => { void refreshFamilyData(); },
      onError: (error) => { void handleMutationError(error); },
    }
  });

  const confirmApproval = () => {
    if (!family || !canReviewFamilies || family.status !== 'PENDING_APPROVAL' || approveMutation.isPending) return;
    Alert.alert('اعتماد الأسرة', 'سيتم تفعيل الأسرة بعد اعتمادها. هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'اعتماد وتفعيل', onPress: () => approveMutation.mutate({ familyId: family.id, data: {} }) },
    ]);
  };
  const confirmArchive = () => {
    if (!family || !canReviewFamilies || family.status === 'ARCHIVED' || archiveMutation.isPending) return;
    Alert.alert('أرشفة الأسرة', 'لن تظهر الأسرة ضمن السجلات النشطة. هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'أرشفة', style: 'destructive', onPress: () => archiveMutation.mutate({ familyId: family.id, data: { expectedVersion: family.version } }) },
    ]);
  };

  if (!signedIn || !canManagePeople) {
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
            <Pressable onPress={() => void refetch()} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text>
            </Pressable>
          </Card>
        )}

        {!isLoading && !isError && !family && (
          <Card style={styles.center}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>لم يتم العثور على العائلة أو لم تعد متاحة.</Text>
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
                {canReviewFamilies && family.status === 'PENDING_APPROVAL' && (
                  <PrimaryButton
                    testID="approve-family"
                    label={approveMutation.isPending ? 'جارٍ الاعتماد...' : 'اعتماد وتفعيل الأسرة'}
                    icon="checkmark-circle-outline"
                    disabled={approveMutation.isPending || archiveMutation.isPending}
                    onPress={confirmApproval}
                  />
                )}
                <PrimaryButton 
                  testID="edit-family"
                  label="تعديل بيانات العائلة" 
                  icon="pencil" 
                  onPress={() => router.push(`/family-form?id=${id}` as never)} 
                />
                {canReviewFamilies && family.status !== 'ARCHIVED' && (
                  <Pressable
                    testID="archive-family"
                    accessibilityRole="button"
                    disabled={archiveMutation.isPending || approveMutation.isPending}
                    onPress={confirmArchive}
                    style={[styles.archiveButton, { borderColor: colors.destructive, opacity: archiveMutation.isPending ? 0.6 : 1 }]}
                  >
                    <Text style={[styles.archiveButtonText, { color: colors.destructive }]}>
                      {archiveMutation.isPending ? 'جارٍ الأرشفة...' : 'أرشفة الأسرة'}
                    </Text>
                  </Pressable>
                )}
                {(approveMutation.isError || archiveMutation.isError) && (
                  <Text style={[styles.actionError, { color: colors.destructive }]}>
                    {getFamilyErrorMessage(approveMutation.error || archiveMutation.error)}
                  </Text>
                )}
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
  actions: { marginTop: 16, gap: 10 },
  archiveButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  archiveButtonText: { fontFamily: fonts.bold, fontSize: 15 },
  actionError: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'right' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center' },
});