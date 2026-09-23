import { AidType, getListAidsQueryKey, useArchiveAid, useUpdateSyncAid } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ArchiveConfirmModal } from '@/components/ArchiveConfirmModal';
import { DataFreshnessNotice, Field, fonts, PrimaryButton, ScreenHeader, SyncTimestamp } from '@/components/ui';
import { type Aid, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getAidSyncPresentation } from '@/lib/aidSyncPresentation';
import { getMutationErrorMessage, showMutationError } from '@/lib/mutationErrors';

const types = [
  [AidType.FOOD, 'غذاء'], [AidType.WATER, 'مياه'], [AidType.MEDICAL, 'صحة'],
  [AidType.SHELTER, 'إيواء'], [AidType.HYGIENE, 'نظافة'], [AidType.OTHER, 'أخرى'],
] as const;

export default function AidDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { aids } = useApp();
  const aid = aids.find((item) => item.id === id);

  if (!aid) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground, fontFamily: fonts.bold }}>لم يتم العثور على الحملة</Text></View>;

  return <AidDetailForm key={`${aid.id}:${aid.version}`} aid={aid} />;
}

function AidDetailForm({ aid }: { aid: Aid }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { aidsSyncMessage, aidsSyncState, canManageAids, lastAidsSyncAt, retryAids } = useApp();
  const updateMutation = useUpdateSyncAid();
  const archiveMutation = useArchiveAid();
  const [title, setTitle] = useState(aid?.title ?? '');
  const [type, setType] = useState(aid?.apiType ?? AidType.FOOD);
  const [quantity, setQuantity] = useState(String(aid?.families ?? ''));
  const [unit, setUnit] = useState(aid?.unit ?? '');
  const [location, setLocation] = useState(aid?.location ?? '');
  const [date, setDate] = useState(aid?.distributionDate.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(aid?.notes ?? '');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getListAidsQueryKey() });
    await queryClient.refetchQueries({ queryKey: getListAidsQueryKey() });
  };
  const save = async () => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateMutation.mutateAsync({
        aidId: aid.id,
        data: {
          title: title.trim(), type, quantity: Number(quantity), unit: unit.trim(),
          location: location.trim(), distributionDate: new Date(date).toISOString(),
          notes: notes.trim() || null, expectedVersion: aid.version,
        },
      });
      await refresh();
      Alert.alert('تم الحفظ', 'تم تحديث الحملة ومزامنتها.');
      router.back();
    } catch (error) {
      setSaveError(getMutationErrorMessage(error));
      await showMutationError(error, refresh);
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 409) router.back();
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  };
  const archive = async () => {
    try {
      await archiveMutation.mutateAsync({ aidId: aid.id, data: { expectedVersion: aid.version } });
      setArchiveOpen(false);
      await refresh();
      router.back();
    } catch (error) {
      setArchiveOpen(false);
      await showMutationError(error, refresh);
    }
  };
  const valid = title.trim().length >= 2 && Number(quantity) >= 1 && unit.trim().length > 0 && location.trim().length >= 2 && !Number.isNaN(new Date(date).getTime());
  const recipientSync = getAidSyncPresentation(aidsSyncState, aidsSyncMessage);

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title={aid.title} subtitle="تعديل بيانات الحملة" />
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
        <Field testID="edit-aid-title" label="اسم الحملة" value={title} onChangeText={setTitle} editable={canManageAids} />
        <Text style={[styles.label, { color: colors.foreground }]}>نوع المساعدة</Text>
        <View style={styles.options}>{types.map(([value, label]) => <Pressable testID={`edit-aid-type-${value}`} disabled={!canManageAids} key={value} onPress={() => setType(value)} style={[styles.option, { backgroundColor: type === value ? colors.primary : colors.muted }]}><Text style={{ color: type === value ? colors.primaryForeground : colors.foreground, fontFamily: fonts.bold }}>{label}</Text></Pressable>)}</View>
        <Field testID="edit-aid-quantity" label="الكمية" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" editable={canManageAids} />
        <View style={styles.recipientSection}>
          <Text testID="aid-recipient-count" style={[styles.recipientCount, { color: recipientSync.recipientCountIsCached || aidsSyncState === 'syncing' ? colors.warning : colors.primary }]}>
            {recipientSync.recipientCountLabel}: {aid.receivedDistributionCount}
          </Text>
          <SyncTimestamp testID="aid-last-successful-sync" lastSyncedAt={lastAidsSyncAt} />
          {recipientSync.recipientCountIsCached ? (
            <DataFreshnessNotice
              testID={recipientSync.warningTestID}
              title={recipientSync.warningTitle}
              message={recipientSync.warningMessage ?? ''}
              lastSyncedAt={lastAidsSyncAt}
              onRetry={() => void retryAids()}
            />
          ) : null}
        </View>
        <Field testID="edit-aid-unit" label="الوحدة" value={unit} onChangeText={setUnit} editable={canManageAids} />
        <Field testID="edit-aid-location" label="الموقع" value={location} onChangeText={setLocation} editable={canManageAids} />
        <Field testID="edit-aid-date" label="تاريخ التوزيع" value={date} onChangeText={setDate} editable={canManageAids} />
        <Field testID="edit-aid-notes" label="ملاحظات" value={notes} onChangeText={setNotes} multiline editable={canManageAids} />
        {saveError ? (
          <View testID="aid-save-error" accessibilityRole="alert" style={[styles.saveError, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
            <Text testID="aid-save-error-message" style={[styles.saveErrorMessage, { color: colors.foreground }]}>{saveError}</Text>
            <PrimaryButton testID="aid-save-error-retry" label="إعادة المحاولة" icon="refresh" disabled={isSaving || updateMutation.isPending} onPress={() => void save()} />
          </View>
        ) : null}
        {canManageAids ? <>
          <PrimaryButton testID="save-aid-edits" label={isSaving || updateMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'} icon="checkmark" disabled={!valid || isSaving || updateMutation.isPending || archiveMutation.isPending} onPress={() => void save()} />
          <Pressable accessibilityRole="button" accessibilityLabel="أرشفة الحملة" testID="archive-aid" disabled={archiveMutation.isPending} onPress={() => setArchiveOpen(true)} style={[styles.archive, { borderColor: colors.destructive }]}><Text style={[styles.archiveText, { color: colors.destructive }]}>أرشفة الحملة</Text></Pressable>
        </> : <Text style={[styles.readOnly, { color: colors.destructive }]}>هذا السجل متاح للعرض فقط حسب دور حسابك.</Text>}
      </KeyboardAwareScrollViewCompat>
      <ArchiveConfirmModal
        visible={archiveOpen}
        title="تأكيد أرشفة الحملة"
        message={`هل تريد أرشفة حملة «${aid.title}»؟ لن تظهر في قائمة الحملات النشطة.`}
        loading={archiveMutation.isPending}
        testIDPrefix="archive-aid"
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => void archive()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 50, gap: 16 },
  label: { fontFamily: fonts.bold, textAlign: 'right' },
  options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  option: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  recipientSection: { gap: 10 },
  recipientCount: { fontFamily: fonts.medium, textAlign: 'right', fontSize: 14 },
  saveError: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  saveErrorMessage: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'right', flexShrink: 1 },
  archive: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  archiveText: { fontFamily: fonts.bold }, readOnly: { fontFamily: fonts.bold, textAlign: 'center' },
});
