import {
  getListSecurityOfficersQueryKey, getListTasksQueryKey, TaskPriority, TaskStatus, useArchiveSyncTask,
  useListSecurityOfficers, useUpdateTaskStatus,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ArchiveConfirmModal } from '@/components/ArchiveConfirmModal';
import { Field, fonts, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getErrorStatus, showMutationError } from '@/lib/mutationErrors';

const priorities = [[TaskPriority.LOW, 'منخفضة'], [TaskPriority.MEDIUM, 'متوسطة'], [TaskPriority.HIGH, 'عالية'], [TaskPriority.URGENT, 'عاجلة']] as const;
const statuses = [[TaskStatus.PENDING, 'معلّقة'], [TaskStatus.IN_PROGRESS, 'قيد التنفيذ'], [TaskStatus.COMPLETED, 'مكتملة'], [TaskStatus.CANCELLED, 'ملغاة']] as const;
export default function TaskFormScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { tasks, canManageTasks, addTask } = useApp();
  const task = tasks.find((item) => item.id === id);
  const updateMutation = useUpdateTaskStatus();
  const archiveMutation = useArchiveSyncTask();
  const officersQuery = useListSecurityOfficers({ query: { queryKey: getListSecurityOfficersQueryKey(), enabled: canManageTasks } });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [location, setLocation] = useState(task?.location ?? '');
  const [priority, setPriority] = useState(task?.priority ?? TaskPriority.MEDIUM);
  const [status, setStatus] = useState(task?.status ?? TaskStatus.PENDING);
  const [dueAt, setDueAt] = useState(task?.dueAt?.slice(0, 10) ?? '');
  const [assignedToId, setAssignedToId] = useState<string | null>(task?.assignedToId ?? null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (id && !task) {
    return <View style={styles.missing}><Text style={[styles.intro, { color: colors.foreground }]}>لم يتم العثور على المهمة أو تمت أرشفتها.</Text></View>;
  }

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    await queryClient.refetchQueries({ queryKey: getListTasksQueryKey() });
  };
  const save = async () => {
    if (!canManageTasks) return;
    try {
      const due = dueAt.trim() ? new Date(dueAt).toISOString() : null;
      if (task) {
        await updateMutation.mutateAsync({ taskId: task.id, data: { title: title.trim(), description: description.trim(), location: location.trim(), priority, status, dueAt: due, assignedToId, expectedVersion: task.version } });
      } else {
        setCreating(true);
        const result = await addTask({ title: title.trim(), description: description.trim(), location: location.trim(), priority, dueAt: due, assignedToId });
        Alert.alert(result.queued ? 'بانتظار المزامنة' : 'تم إنشاء المهمة', result.queued ? 'حُفظت المهمة على الجهاز وستُرسل عند عودة الاتصال.' : 'تمت مزامنة المهمة مع الفريق.');
      }
      await refresh();
      router.back();
    } catch (error) {
      await showMutationError(error, refresh);
      if (getErrorStatus(error) === 409) router.back();
    } finally {
      setCreating(false);
    }
  };
  const archive = async () => {
    if (!task) return;
    try {
      await archiveMutation.mutateAsync({ taskId: task.id, data: { expectedVersion: task.version } });
      setArchiveOpen(false);
      await refresh();
      router.back();
    } catch (error) {
      setArchiveOpen(false);
      await showMutationError(error, refresh);
    }
  };
  const busy = creating || updateMutation.isPending || archiveMutation.isPending;
  const valid = title.trim().length >= 2 && description.trim().length > 0 && location.trim().length >= 2 && (!dueAt.trim() || !Number.isNaN(new Date(dueAt).getTime()));

  return (<>
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>{task ? 'تحديث تفاصيل المهمة وحالتها' : 'إنشاء مهمة أمنية جديدة'}</Text>
      <Field testID="task-title" label="عنوان المهمة" value={title} onChangeText={setTitle} />
      <Field testID="task-description" label="التفاصيل" value={description} onChangeText={setDescription} multiline />
      <Field testID="task-location" label="الموقع" value={location} onChangeText={setLocation} />
      <Field testID="task-due-date" label="تاريخ الاستحقاق (اختياري)" value={dueAt} onChangeText={setDueAt} placeholder="2026-08-28" />
      <Text style={[styles.label, { color: colors.foreground }]}>الأولوية</Text>
      <View style={styles.options}>{priorities.map(([value, label]) => <Pressable testID={`task-priority-${value}`} key={value} onPress={() => setPriority(value)} style={[styles.option, { backgroundColor: priority === value ? colors.primary : colors.muted }]}><Text style={[styles.optionText, { color: priority === value ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>)}</View>
      <Text style={[styles.label, { color: colors.foreground }]}>المكلّف بالمهمة (اختياري)</Text>
      <View style={styles.options}>
        <Pressable testID="task-assignee-none" onPress={() => setAssignedToId(null)} style={[styles.option, { backgroundColor: assignedToId === null ? colors.primary : colors.muted }]}><Text style={[styles.optionText, { color: assignedToId === null ? colors.primaryForeground : colors.foreground }]}>غير مكلّف</Text></Pressable>
        {(officersQuery.data ?? []).map((officer) => <Pressable testID={`task-assignee-${officer.id}`} key={officer.id} onPress={() => setAssignedToId(officer.id)} style={[styles.option, { backgroundColor: assignedToId === officer.id ? colors.primary : colors.muted }]}><Text style={[styles.optionText, { color: assignedToId === officer.id ? colors.primaryForeground : colors.foreground }]}>{officer.name}</Text></Pressable>)}
      </View>
      {officersQuery.isLoading ? <Text style={[styles.helper, { color: colors.mutedForeground }]}>جارٍ تحميل مسؤولي الأمن…</Text> : null}
      {officersQuery.isError ? <Text style={[styles.helper, { color: colors.destructive }]}>تعذر تحميل قائمة مسؤولي الأمن.</Text> : null}
      {task ? <>
        <Text style={[styles.label, { color: colors.foreground }]}>الحالة</Text>
        <View style={styles.options}>{statuses.map(([value, label]) => <Pressable testID={`task-status-${value}`} key={value} onPress={() => setStatus(value)} style={[styles.option, { backgroundColor: status === value ? colors.primary : colors.muted }]}><Text style={[styles.optionText, { color: status === value ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>)}</View>
      </> : null}
      <PrimaryButton testID="save-task" label={busy ? 'جارٍ الحفظ…' : task ? 'حفظ التعديلات' : 'إنشاء المهمة'} icon="checkmark" disabled={!valid || busy || !canManageTasks} onPress={() => void save()} />
      {task ? <Pressable testID="archive-task" disabled={busy} onPress={() => setArchiveOpen(true)} style={[styles.archive, { borderColor: colors.destructive }]}><Text style={[styles.archiveText, { color: colors.destructive }]}>أرشفة المهمة</Text></Pressable> : null}
    </KeyboardAwareScrollViewCompat>
    <ArchiveConfirmModal
      visible={archiveOpen}
      title="تأكيد أرشفة المهمة الأمنية"
      message={`هل تريد أرشفة مهمة «${task?.title ?? ''}»؟ لن تظهر في قائمة المهام النشطة.`}
      loading={archiveMutation.isPending}
      testIDPrefix="archive-task"
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
  helper: { fontFamily: fonts.regular, textAlign: 'right', marginTop: -8 },
  archive: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, archiveText: { fontFamily: fonts.bold },
});