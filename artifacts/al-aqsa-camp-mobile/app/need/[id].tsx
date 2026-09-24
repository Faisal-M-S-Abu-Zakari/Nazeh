import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { ScreenHeader, Card, Field, fonts, StatusPill, PrimaryButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useListNeeds, useUpdateNeed, useArchiveNeed, getListNeedsQueryKey, NeedStatus } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { getMutationErrorMessage } from '@/lib/mutationErrors';

export default function NeedScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, canManagePeople } = useApp();
  const canReadNeeds = canManagePeople || user?.role === 'SECURITY_OFFICER';
  const canArchive = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const inFlight = useRef(false);
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const { data: needsPage, isLoading, isError, refetch } = useListNeeds({
    query: { enabled: canReadNeeds, queryKey: getListNeedsQueryKey() }
  });

  const need = useMemo(() => {
    return needsPage?.find((n) => n.id === id);
  }, [needsPage, id]);

  const updateMutation = useUpdateNeed({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() });
        Alert.alert('نجاح', 'تم تحديث حالة الاحتياج بنجاح');
      },
      onError: (err) => {
        Alert.alert('تعذر تحديث الاحتياج', getMutationErrorMessage(err));
      }
    }
  });
  const archiveMutation = useArchiveNeed();

  const handleUpdateStatus = (status: NeedStatus) => {
    if (!need || inFlight.current) return;
    inFlight.current = true;
    updateMutation.mutate({
      needId: need.id,
      data: {
        status,
        expectedVersion: need.version,
        note: note.trim() || undefined,
      }
    }, { onSettled: () => { inFlight.current = false; } });
  };

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

  const translateCategory = (cat: string) => {
    switch(cat) {
      case 'FOOD': return 'غذاء';
      case 'WATER': return 'مياه';
      case 'MEDICAL': return 'صحة';
      case 'SHELTER': return 'مأوى';
      case 'HYGIENE': return 'نظافة';
      default: return 'أخرى';
    }
  };

  const translatePriority = (p: string) => {
    switch(p) {
      case 'LOW': return 'منخفضة';
      case 'MEDIUM': return 'متوسطة';
      case 'HIGH': return 'عالية';
      case 'CRITICAL': return 'حرجة';
      default: return p;
    }
  };

  if (!canReadNeeds) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="تفاصيل الاحتياج" />
        <View style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>ليس لديك صلاحية لعرض الاحتياج.</Text></View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="تفاصيل الاحتياج" />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (isError) return <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}><ScreenHeader title="تفاصيل الاحتياج" /><Card style={styles.center}><Text style={{ color: colors.destructive }}>تعذر تحميل الاحتياج.</Text><Pressable accessibilityRole="button" onPress={() => void refetch()}><Text style={{ color: colors.primary }}>إعادة المحاولة</Text></Pressable></Card></View>;

  if (!need) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="تفاصيل الاحتياج" />
        <Card style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>لم يتم العثور على الاحتياج.</Text></Card>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="تفاصيل الاحتياج" />
      
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.mainCard}>
          <View style={styles.titleRow}>
            <StatusPill text={getStatusText(need.status)} tone={need.status === 'FULFILLED' ? 'green' : 'gold'} />
            <Text style={[styles.title, { color: colors.foreground }]}>{need.title}</Text>
          </View>
          
          {need.description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>{need.description}</Text>
          ) : null}
          
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>التصنيف</Text>
              <Text style={[styles.gridValue, { color: colors.foreground }]}>{translateCategory(need.category)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>الأهمية</Text>
              <Text style={[styles.gridValue, { color: colors.foreground }]}>{translatePriority(need.priority)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>تاريخ الطلب</Text>
              <Text style={[styles.gridValue, { color: colors.foreground }]}>{new Date(need.createdAt).toLocaleDateString('ar')}</Text>
            </View>
          </View>
        </Card>

        {canManagePeople ? <Pressable onPress={() => router.push(`/family/${need.familyId}` as never)}>
          <Card style={styles.familyCard}>
            <View style={styles.familyRow}>
              <View style={styles.familyInfo}>
                <Text style={[styles.familyLabel, { color: colors.mutedForeground }]}>معرف العائلة الطالبة</Text>
                <Text style={[styles.familyName, { color: colors.foreground }]}>{need.familyId}</Text>
              </View>
              <View style={[styles.iconBox, { backgroundColor: colors.accent }]}>
                <Ionicons name="people" size={24} color={colors.primary} />
              </View>
            </View>
          </Card>
        </Pressable> : null}

        <View style={styles.actions}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>تحديث حالة الاحتياج:</Text>
          <Field label="ملاحظة التحديث (اختياري)" value={note} onChangeText={setNote} multiline />
          {need.status === 'REQUIRED' ? <PrimaryButton label="اعتماد الاحتياج" icon="checkmark" onPress={() => handleUpdateStatus('APPROVED')} disabled={updateMutation.isPending} /> : null}
          {need.status === 'APPROVED' && (
            <PrimaryButton 
              label={updateMutation.isPending ? "جارٍ الحفظ..." : "تحديث إلى: قيد التنفيذ"} 
              icon="play-outline" 
              onPress={() => handleUpdateStatus('IN_PROGRESS' as NeedStatus)} 
              disabled={updateMutation.isPending}
            />
          )}
          {need.status === 'IN_PROGRESS' && (
            <View style={{ marginTop: 8 }}>
              <PrimaryButton 
                label={updateMutation.isPending ? "جارٍ الحفظ..." : "تحديث إلى: مكتمل"} 
                icon="checkmark-circle-outline" 
                onPress={() => handleUpdateStatus('FULFILLED' as NeedStatus)} 
                disabled={updateMutation.isPending}
              />
            </View>
          )}
          {(['REQUIRED', 'APPROVED', 'IN_PROGRESS'] as const).includes(need.status as 'REQUIRED' | 'APPROVED' | 'IN_PROGRESS') ? <PrimaryButton label="إلغاء الاحتياج" icon="close-circle-outline" onPress={() => handleUpdateStatus('CANCELLED')} disabled={updateMutation.isPending} /> : null}
          {canArchive ? <PrimaryButton label={archiveMutation.isPending ? 'جارٍ الأرشفة...' : 'أرشفة الاحتياج'} icon="archive-outline" disabled={archiveMutation.isPending || updateMutation.isPending} onPress={() => {
            if (inFlight.current) return;
            Alert.alert('تأكيد الأرشفة', 'هل تريد أرشفة هذا الاحتياج؟', [{ text: 'تراجع', style: 'cancel' }, { text: 'أرشفة', style: 'destructive', onPress: async () => {
              inFlight.current = true;
              try { await archiveMutation.mutateAsync({ needId: need.id, data: { expectedVersion: need.version } }); await queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() }); router.back(); }
              catch (error) { Alert.alert('تعذر الأرشفة', getMutationErrorMessage(error)); }
              finally { inFlight.current = false; }
            } }]);
          }} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  mainCard: { padding: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { flex: 1, fontFamily: fonts.extraBold, fontSize: 20, textAlign: 'right', marginLeft: 12 },
  description: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26, textAlign: 'right', marginBottom: 20 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 16, borderTopWidth: 1, borderTopColor: '#00000010', paddingTop: 16 },
  gridItem: { minWidth: '30%', alignItems: 'flex-end' },
  gridLabel: { fontFamily: fonts.medium, fontSize: 12, marginBottom: 4 },
  gridValue: { fontFamily: fonts.bold, fontSize: 15 },
  familyCard: { padding: 16 },
  familyRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 16 },
  familyInfo: { alignItems: 'flex-end' },
  familyLabel: { fontFamily: fonts.medium, fontSize: 13, marginBottom: 2 },
  familyName: { fontFamily: fonts.bold, fontSize: 18 },
  iconBox: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'right', marginBottom: 8 },
  actions: { marginTop: 16 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
});