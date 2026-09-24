import {
  ComplaintStatus, getListComplaintsQueryKey, useArchiveSyncComplaint,
  useUpdateComplaintStatus,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ArchiveConfirmModal } from '@/components/ArchiveConfirmModal';
import { Field, fonts, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getErrorStatus, getMutationErrorMessage, showMutationError } from '@/lib/mutationErrors';

const statuses = [
  [ComplaintStatus.OPEN, 'مفتوحة'], [ComplaintStatus.IN_REVIEW, 'قيد المراجعة'],
  [ComplaintStatus.RESOLVED, 'محلولة'], [ComplaintStatus.REJECTED, 'مرفوضة'],
] as const;
export default function ComplaintFormScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { complaints, canManageComplaints, addComplaint } = useApp();
  const complaint = complaints.find((item) => item.id === id);
  const updateMutation = useUpdateComplaintStatus();
  const archiveMutation = useArchiveSyncComplaint();
  const saveInFlight = useRef(false);
  const archiveInFlight = useRef(false);
  const [creating, setCreating] = useState(false);
  const [complainantName, setComplainantName] = useState(complaint?.complainantName ?? '');
  const [subject, setSubject] = useState(complaint?.subject ?? '');
  const [description, setDescription] = useState(complaint?.description ?? '');
  const [location, setLocation] = useState(complaint?.location ?? '');
  const [reply, setReply] = useState(complaint?.reply ?? '');
  const [status, setStatus] = useState(complaint?.status ?? ComplaintStatus.OPEN);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (id && !complaint) {
    return <View style={styles.missing}><Text style={[styles.intro, { color: colors.foreground }]}>لم يتم العثور على الشكوى أو تمت أرشفتها.</Text></View>;
  }

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
    await queryClient.refetchQueries({ queryKey: getListComplaintsQueryKey() });
  };
  const save = async () => {
    if (!canManageComplaints || saveInFlight.current) return;
    saveInFlight.current = true;
    setSaveError(null);
    try {
      if (complaint) {
        await updateMutation.mutateAsync({
          complaintId: complaint.id,
          data: {
            complainantName: complainantName.trim(), subject: subject.trim(),
            description: description.trim(), location: location.trim() || null,
            reply: reply.trim() || null, status, expectedVersion: complaint.version,
          },
        });
      } else {
        setCreating(true);
        const result = await addComplaint({ complainantName: complainantName.trim(), subject: subject.trim(), description: description.trim(), location: location.trim() || undefined });
        Alert.alert(result.queued ? 'بانتظار المزامنة' : 'تم إنشاء الشكوى', result.queued ? 'حُفظت الشكوى على الجهاز وستُرسل عند عودة الاتصال.' : 'تمت مزامنة الشكوى مع الفريق.');
      }
      await refresh();
      router.back();
    } catch (error) {
      setSaveError(getMutationErrorMessage(error));
      await showMutationError(error, refresh);
      if (getErrorStatus(error) === 409) router.back();
    } finally {
      setCreating(false);
      saveInFlight.current = false;
    }
  };
  const archive = async () => {
    if (!complaint || !canManageComplaints || archiveInFlight.current) return;
    archiveInFlight.current = true;
    try {
      await archiveMutation.mutateAsync({ complaintId: complaint.id, data: { expectedVersion: complaint.version } });
      setArchiveOpen(false);
      await refresh();
      router.back();
    } catch (error) {
      setArchiveOpen(false);
      await showMutationError(error, refresh);
    } finally {
      archiveInFlight.current = false;
    }
  };
  const busy = creating || updateMutation.isPending || archiveMutation.isPending;
  const valid = complainantName.trim().length >= 2 && subject.trim().length >= 2 && description.trim().length >= 1;

  return (<>
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>{complaint ? 'تحديث بيانات الشكوى وحالتها' : 'تسجيل شكوى جديدة للفريق'}</Text>
      {canManageComplaints ? <>
        <Field testID="complaint-name" label="اسم مقدم الشكوى" value={complainantName} onChangeText={setComplainantName} />
        <Field testID="complaint-subject" label="الموضوع" value={subject} onChangeText={setSubject} />
        <Field testID="complaint-description" label="التفاصيل" value={description} onChangeText={setDescription} multiline />
        <Field testID="complaint-location" label="الموقع (اختياري)" value={location} onChangeText={setLocation} />
      </> : null}
      {complaint && canManageComplaints ? <>
        <Text style={[styles.label, { color: colors.foreground }]}>الحالة</Text>
        <View style={styles.options}>{statuses.map(([value, label]) => <Pressable testID={`complaint-status-${value}`} key={value} onPress={() => setStatus(value)} style={[styles.option, { backgroundColor: status === value ? colors.primary : colors.muted }]}><Text style={[styles.optionText, { color: status === value ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>)}</View>
        <Field testID="complaint-reply" label="رد الفريق (اختياري)" value={reply} onChangeText={setReply} multiline />
      </> : null}
      {complaint && !canManageComplaints ? <>
        <Text style={[styles.label, { color: colors.foreground }]}>{complaint.subject}</Text>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>{complaint.complainantName}: {complaint.description}</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>الحالة: {statuses.find(([value]) => value === complaint.status)?.[1] ?? complaint.status}</Text>
        {complaint.location ? <Text style={[styles.intro, { color: colors.mutedForeground }]}>الموقع: {complaint.location}</Text> : null}
        {complaint.reply ? <Text style={[styles.intro, { color: colors.mutedForeground }]}>رد الفريق: {complaint.reply}</Text> : null}
      </> : null}
      {!complaint && !canManageComplaints ? <Text style={[styles.intro, { color: colors.destructive }]}>لا تملك الصلاحية لتسجيل الشكاوى.</Text> : null}
      {saveError && canManageComplaints ? (
        <View testID="complaint-save-error" accessibilityRole="alert" style={[styles.saveError, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
          <Text testID="complaint-save-error-message" style={[styles.saveErrorMessage, { color: colors.foreground }]}>{saveError}</Text>
          <PrimaryButton testID="complaint-save-error-retry" label="إعادة المحاولة" icon="refresh" disabled={busy} onPress={() => void save()} />
        </View>
      ) : null}
      {canManageComplaints ? <PrimaryButton testID="save-complaint" label={busy ? 'جارٍ الحفظ…' : complaint ? 'حفظ التعديلات' : 'إنشاء الشكوى'} icon="checkmark" disabled={!valid || busy} onPress={() => void save()} /> : null}
      {complaint && canManageComplaints ? <Pressable testID="archive-complaint" disabled={busy} onPress={() => setArchiveOpen(true)} style={[styles.archive, { borderColor: colors.destructive }]}><Text style={[styles.archiveText, { color: colors.destructive }]}>أرشفة الشكوى</Text></Pressable> : null}
    </KeyboardAwareScrollViewCompat>
    <ArchiveConfirmModal
      visible={archiveOpen}
      title="تأكيد أرشفة الشكوى"
      message={`هل تريد أرشفة شكوى «${complaint?.subject ?? ''}»؟ لن تظهر في قائمة الشكاوى النشطة.`}
      loading={archiveMutation.isPending}
      testIDPrefix="archive-complaint"
      onCancel={() => setArchiveOpen(false)}
      onConfirm={() => void archive()}
    />
  </>);
}

const styles = StyleSheet.create({
  missing: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 22, gap: 16 }, intro: { fontFamily: fonts.regular, textAlign: 'right' },
  label: { fontFamily: fonts.bold, textAlign: 'right' }, options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  option: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10 }, optionText: { fontFamily: fonts.bold },
  archive: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, archiveText: { fontFamily: fonts.bold },
  saveError: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  saveErrorMessage: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'right', flexShrink: 1 },
});