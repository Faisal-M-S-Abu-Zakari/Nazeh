import {
  getListSecurityMembersQueryKey, getListTasksQueryKey, TaskPriority, TaskStatus, type Task, useArchiveSyncTask,
  useListSecurityMembers, useListTasks, useUpdateTaskStatus, useSubmitTask, useApproveTask
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ArchiveConfirmModal } from '@/components/ArchiveConfirmModal';
import { Field, fonts, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getMutationErrorMessage, isVersionConflict, showMutationError } from '@/lib/mutationErrors';

const priorities = [[TaskPriority.LOW, 'منخفضة'], [TaskPriority.MEDIUM, 'متوسطة'], [TaskPriority.HIGH, 'عالية'], [TaskPriority.URGENT, 'عاجلة']] as const;
const statuses = [[TaskStatus.PENDING, 'معلّقة'], [TaskStatus.IN_PROGRESS, 'قيد التنفيذ'], [TaskStatus.COMPLETED, 'مكتملة'], [TaskStatus.CANCELLED, 'ملغاة']] as const;
type TaskAction = 'result' | 'approval';
type TaskActionError = {
  action: TaskAction;
  message: string;
  conflict?: {
    expectedVersion: number;
    latestVersion: number | null;
    acknowledged: boolean;
  };
};
type TaskEditConflict = {
  expectedVersion: number;
  latestVersion: number | null;
  acknowledged: boolean;
};
export default function TaskFormScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { tasks } = useApp();
  const tasksQuery = useListTasks({
    query: {
      queryKey: getListTasksQueryKey(),
      enabled: !!id,
      retry: false,
    },
  });
  const task = tasks.find((item) => item.id === id) ?? tasksQuery.data?.find((item) => item.id === id);

  if (id && !task) {
    if (tasksQuery.isLoading || tasksQuery.isFetching) {
      return (
        <View testID="task-form-loading" accessibilityRole="progressbar" style={styles.missing}>
          <ActivityIndicator color={colors.primary} />
          <Text allowFontScaling style={[styles.intro, { color: colors.foreground }]}>جارٍ تحميل بيانات المهمة…</Text>
        </View>
      );
    }
    if (tasksQuery.isError) {
      return (
        <View testID="task-form-load-error" style={styles.missing}>
          <Text allowFontScaling style={[styles.intro, { color: colors.foreground }]}>تعذر تحميل بيانات المهمة.</Text>
          <PrimaryButton testID="task-form-load-retry" label="إعادة المحاولة" icon="refresh" onPress={() => void tasksQuery.refetch()} />
        </View>
      );
    }
    return <View testID="task-form-not-found" style={styles.missing}><Text allowFontScaling style={[styles.intro, { color: colors.foreground }]}>لم يتم العثور على المهمة أو تمت أرشفتها.</Text></View>;
  }

  return <TaskFormEditor key={task?.id ?? 'new-task'} task={task} />;
}

function TaskFormEditor({ task }: { task?: Task }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { canManageTasks, addTask, user } = useApp();
  const originalTask = useRef<Task | null>(task ?? null);
  const canManageTaskRecords = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SECURITY_OFFICER';
  const updateMutation = useUpdateTaskStatus();
  const archiveMutation = useArchiveSyncTask();
  const officersQuery = useListSecurityMembers({
    query: { queryKey: getListSecurityMembersQueryKey(), enabled: canManageTaskRecords, retry: false },
  });
  const saveInFlight = useRef(false);
  const archiveInFlight = useRef(false);
  const resultInFlight = useRef(false);
  const approvalInFlight = useRef(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [location, setLocation] = useState(task?.location ?? '');
  const [priority, setPriority] = useState(task?.priority ?? TaskPriority.MEDIUM);
  const [status, setStatus] = useState(task?.status ?? TaskStatus.PENDING);
  const [dueAt, setDueAt] = useState(task?.dueAt?.slice(0, 10) ?? '');
  const [assignedToId, setAssignedToId] = useState<string | null>(task?.assignedToId ?? null);
  const currentInactiveAssignee = (officersQuery.data ?? []).find(
    (officer) => officer.id === task?.assignedToId && !officer.active,
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [taskEditConflict, setTaskEditConflict] = useState<TaskEditConflict | null>(null);
  const [refreshingTaskConflict, setRefreshingTaskConflict] = useState(false);
  const [taskActionError, setTaskActionError] = useState<TaskActionError | null>(null);
  const [refreshingConflict, setRefreshingConflict] = useState(false);

  const [resultText, setResultText] = useState(task?.result ?? '');
  const [approvalNote, setApprovalNote] = useState('');
  const canSubmitResult = user?.role === 'SECURITY_MEMBER';
  const canApproveResult = canManageTaskRecords;

  const submitResultMutation = useSubmitTask();
  const approveMutation = useApproveTask();

  const refresh = async (): Promise<Task[]> => {
    const queryKey = getListTasksQueryKey();
    await queryClient.refetchQueries({ queryKey, type: 'active' }, { throwOnError: true });
    return queryClient.getQueryData<Task[]>(queryKey) ?? [];
  };
  const resetTaskEditReview = () => {
    setTaskEditConflict((current) => current ? { ...current, acknowledged: false } : current);
  };
  const mergeTaskDraftWithLatest = (latest: Task) => {
    const baseline = originalTask.current;
    if (!baseline || baseline.id !== latest.id) {
      setTitle(latest.title);
      setDescription(latest.description);
      setLocation(latest.location);
      setPriority(latest.priority);
      setStatus(latest.status);
      setDueAt(latest.dueAt?.slice(0, 10) ?? '');
      setAssignedToId(latest.assignedToId ?? null);
      originalTask.current = latest;
      return;
    }

    if (title === baseline.title) setTitle(latest.title);
    if (description === baseline.description) setDescription(latest.description);
    if (location === baseline.location) setLocation(latest.location);
    if (priority === baseline.priority) setPriority(latest.priority);
    if (status === baseline.status) setStatus(latest.status);
    if (dueAt === (baseline.dueAt?.slice(0, 10) ?? '')) setDueAt(latest.dueAt?.slice(0, 10) ?? '');
    if (assignedToId === (baseline.assignedToId ?? null)) setAssignedToId(latest.assignedToId ?? null);
    originalTask.current = latest;
  };
  const loadLatestAfterTaskEditConflict = async (expectedVersion: number) => {
    let latestVersion: number | null = null;
    try {
      const latestTasks = await refresh();
      const latest = latestTasks.find((item) => item.id === task?.id);
      if (latest && latest.version > expectedVersion) {
        mergeTaskDraftWithLatest(latest);
        latestVersion = latest.version;
      }
    } catch {
      // Keep the draft and require a successful refresh before enabling another save.
    }
    setTaskEditConflict({ expectedVersion, latestVersion, acknowledged: false });
  };
  const refreshTaskEditConflict = async () => {
    if (!taskEditConflict || refreshingTaskConflict) return;
    setRefreshingTaskConflict(true);
    try {
      await loadLatestAfterTaskEditConflict(taskEditConflict.expectedVersion);
    } finally {
      setRefreshingTaskConflict(false);
    }
  };
  const handleTaskActionFailure = async (error: unknown, action: TaskAction, expectedVersion: number) => {
    if (isVersionConflict(error)) {
      let latestVersion: number | null = null;
      try {
        const latestTasks = await refresh();
        latestVersion = latestTasks.find((item) => item.id === task?.id)?.version ?? null;
      } catch {
        // Keep the conflict visible and require a successful refresh before retrying.
      }
      setTaskActionError({
        action,
        message: getMutationErrorMessage(error),
        conflict: { expectedVersion, latestVersion, acknowledged: false },
      });
      return;
    }
    setTaskActionError({ action, message: getMutationErrorMessage(error) });
    await showMutationError(error, refresh);
  };
  const refreshConflictedTask = async (action: TaskAction) => {
    if (!taskActionError?.conflict || taskActionError.action !== action || refreshingConflict) return;
    setRefreshingConflict(true);
    try {
      const latestTasks = await refresh();
      const latestVersion = latestTasks.find((item) => item.id === task?.id)?.version ?? null;
      setTaskActionError((current) => current?.action === action && current.conflict
        ? { ...current, conflict: { ...current.conflict, latestVersion, acknowledged: false } }
        : current);
    } catch {
      setTaskActionError((current) => current?.action === action && current.conflict
        ? { ...current, conflict: { ...current.conflict, latestVersion: null, acknowledged: false } }
        : current);
    } finally {
      setRefreshingConflict(false);
    }
  };
  const acknowledgeTaskConflict = (action: TaskAction) => {
    setTaskActionError((current) => current?.action === action && current.conflict
      ? { ...current, conflict: { ...current.conflict, acknowledged: true } }
      : current);
  };
  const resetTaskConflictReview = (action: TaskAction) => {
    setTaskActionError((current) => current?.action === action && current.conflict
      ? { ...current, conflict: { ...current.conflict, acknowledged: false } }
      : current);
  };
  const submitResult = async () => {
    if (!task || !canSubmitResult || !resultText.trim() || resultInFlight.current) return;
    const expectedVersion = task.version;
    resultInFlight.current = true;
    setTaskActionError(null);
    try {
      await submitResultMutation.mutateAsync({ taskId: task.id, data: { result: resultText.trim(), expectedVersion } });
      await refresh();
    } catch (error) {
      await handleTaskActionFailure(error, 'result', expectedVersion);
    } finally {
      resultInFlight.current = false;
    }
  };
  const approveResult = async () => {
    if (!task || !canApproveResult || approvalInFlight.current) return;
    const expectedVersion = task.version;
    approvalInFlight.current = true;
    setTaskActionError(null);
    try {
      await approveMutation.mutateAsync({ taskId: task.id, data: { note: approvalNote.trim() || undefined, expectedVersion } });
      await refresh();
    } catch (error) {
      await handleTaskActionFailure(error, 'approval', expectedVersion);
    } finally {
      approvalInFlight.current = false;
    }
  };
  const save = async () => {
    if (!canManageTaskRecords || !canManageTasks || saveInFlight.current) return;
    if (taskEditConflict && (
      !task ||
      !taskEditConflict.acknowledged ||
      taskEditConflict.latestVersion === null ||
      task.version !== taskEditConflict.latestVersion
    )) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const due = dueAt.trim() ? new Date(dueAt).toISOString() : null;
      if (task) {
        await updateMutation.mutateAsync({ taskId: task.id, data: { title: title.trim(), description: description.trim(), location: location.trim(), priority, status, dueAt: due, assignedToId, expectedVersion: task.version } });
      } else {
        setCreating(true);
        const result = await addTask({ title: title.trim(), description: description.trim(), location: location.trim(), priority, dueAt: due, assignedToId });
        Alert.alert(result.queued ? 'بانتظار المزامنة' : 'تم إنشاء المهمة', result.queued ? 'حُفظت المهمة على الجهاز وستُرسل عند عودة الاتصال.' : 'تمت مزامنة المهمة مع الفريق.');
      }
      setTaskEditConflict(null);
      await refresh();
      router.back();
    } catch (error) {
      setSaveError(getMutationErrorMessage(error));
      if (task && isVersionConflict(error)) {
        await loadLatestAfterTaskEditConflict(task.version);
      } else {
        await showMutationError(error, refresh);
      }
    } finally {
      setCreating(false);
      saveInFlight.current = false;
      setSaving(false);
    }
  };
  const archive = async () => {
    if (!task || !canManageTaskRecords || archiveInFlight.current) return;
    archiveInFlight.current = true;
    try {
      await archiveMutation.mutateAsync({ taskId: task.id, data: { expectedVersion: task.version } });
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
  const renderTaskActionError = (
    action: TaskAction,
    testIDPrefix: string,
    retry: () => void,
    pending: boolean,
  ) => {
    if (taskActionError?.action !== action) return null;
    const conflict = taskActionError.conflict;
    const latestVersionLoaded = !!(
      conflict &&
      task &&
      conflict.latestVersion !== null &&
      conflict.latestVersion > conflict.expectedVersion &&
      task.version === conflict.latestVersion
    );
    const actionStillAvailable = action === 'result'
      ? task?.status === TaskStatus.IN_PROGRESS
      : task?.status === TaskStatus.COMPLETED && !task.approvedAt;

    return (
      <View testID={`${testIDPrefix}-error`} accessibilityRole="alert" style={[styles.saveError, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
        <Text allowFontScaling testID={`${testIDPrefix}-error-message`} style={[styles.saveErrorMessage, { color: colors.foreground }]}>{taskActionError.message}</Text>
        {conflict ? (
          <>
            {task ? (
              <Text allowFontScaling testID={`${testIDPrefix}-current-version`} style={[styles.saveErrorMessage, { color: colors.foreground }]}>
                أحدث حالة للمهمة: {statuses.find(([value]) => value === task.status)?.[1] ?? task.status} · الإصدار {task.version}
              </Text>
            ) : null}
            {!latestVersionLoaded ? (
              <PrimaryButton
                testID={`${testIDPrefix}-refresh-current`}
                label={refreshingConflict ? 'جارٍ تحديث المهمة…' : 'تحديث بيانات المهمة'}
                icon="refresh"
                disabled={pending || refreshingConflict}
                onPress={() => void refreshConflictedTask(action)}
              />
            ) : !actionStillAvailable ? (
              <Text allowFontScaling testID={`${testIDPrefix}-retry-unavailable`} style={[styles.saveErrorMessage, { color: colors.foreground }]}>
                لم تعد هذه الخطوة متاحة بعد تحديث المهمة؛ احتفظنا بمدخلاتك للمراجعة.
              </Text>
            ) : !conflict.acknowledged ? (
              <>
                <Text allowFontScaling style={[styles.saveErrorMessage, { color: colors.foreground }]}>
                  راجع أحدث بيانات المهمة، ثم أكّد المراجعة لتمكين إعادة المحاولة.
                </Text>
                <PrimaryButton
                  testID={`${testIDPrefix}-review-update`}
                  label="راجعت التحديث"
                  icon="checkmark"
                  disabled={pending}
                  onPress={() => acknowledgeTaskConflict(action)}
                />
              </>
            ) : (
              <PrimaryButton testID={`${testIDPrefix}-error-retry`} label="إعادة المحاولة" icon="refresh" disabled={pending} onPress={() => retry()} />
            )}
          </>
        ) : (
          <PrimaryButton testID={`${testIDPrefix}-error-retry`} label="إعادة المحاولة" icon="refresh" disabled={pending} onPress={() => retry()} />
        )}
      </View>
    );
  };
  const busy = saving || creating || updateMutation.isPending || archiveMutation.isPending;
  const taskEditConflictLatestLoaded = !!(
    taskEditConflict &&
    task &&
    taskEditConflict.latestVersion !== null &&
    task.version === taskEditConflict.latestVersion &&
    task.version > taskEditConflict.expectedVersion
  );
  const valid = title.trim().length >= 2 && description.trim().length > 0 && location.trim().length >= 2 && (!dueAt.trim() || !Number.isNaN(new Date(dueAt).getTime()));
  const showResultForm = task && canSubmitResult && (
    task.status === TaskStatus.IN_PROGRESS ||
    (taskActionError?.action === 'result' && !!taskActionError.conflict)
  );
  const showApprovalForm = task && canApproveResult && (
    (task.status === TaskStatus.COMPLETED && !task.approvedAt) ||
    (taskActionError?.action === 'approval' && !!taskActionError.conflict)
  );

  return (<>
    <KeyboardAwareScrollViewCompat testID="task-form-scroll" contentContainerStyle={styles.content} bottomOffset={60}>
      <Text allowFontScaling style={[styles.intro, { color: colors.mutedForeground }]}>{task ? canManageTaskRecords ? 'تحديث تفاصيل المهمة وحالتها' : 'تفاصيل المهمة الأمنية' : 'إنشاء مهمة أمنية جديدة'}</Text>
      {task && !canManageTaskRecords ? <>
        <Text allowFontScaling style={[styles.label, { color: colors.foreground }]}>{task.title}</Text>
        <Text allowFontScaling style={[styles.intro, { color: colors.mutedForeground }]}>{task.description} · {task.location}</Text>
      </> : null}
      {canManageTaskRecords ? <>
      <Field testID="task-title" label="عنوان المهمة" value={title} editable={!busy && !refreshingTaskConflict} onChangeText={(value) => { setTitle(value); resetTaskEditReview(); }} />
      <Field testID="task-description" label="التفاصيل" value={description} editable={!busy && !refreshingTaskConflict} onChangeText={(value) => { setDescription(value); resetTaskEditReview(); }} multiline />
      <Field testID="task-location" label="الموقع" value={location} editable={!busy && !refreshingTaskConflict} onChangeText={(value) => { setLocation(value); resetTaskEditReview(); }} />
      <Field testID="task-due-date" label="تاريخ الاستحقاق (اختياري)" value={dueAt} editable={!busy && !refreshingTaskConflict} onChangeText={(value) => { setDueAt(value); resetTaskEditReview(); }} placeholder="2026-08-28" />
      <Text allowFontScaling style={[styles.label, { color: colors.foreground }]}>الأولوية</Text>
      <View style={styles.options}>{priorities.map(([value, label]) => <Pressable testID={`task-priority-${value}`} key={value} disabled={busy || refreshingTaskConflict} onPress={() => { setPriority(value); resetTaskEditReview(); }} style={[styles.option, { backgroundColor: priority === value ? colors.primary : colors.muted }]}><Text allowFontScaling style={[styles.optionText, { color: priority === value ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>)}</View>
      <Text allowFontScaling style={[styles.label, { color: colors.foreground }]}>المكلّف بالمهمة (اختياري)</Text>
      <View style={styles.options}>
        <Pressable testID="task-assignee-none" disabled={busy || refreshingTaskConflict} onPress={() => { setAssignedToId(null); resetTaskEditReview(); }} style={[styles.option, { backgroundColor: assignedToId === null ? colors.primary : colors.muted }]}><Text allowFontScaling style={[styles.optionText, { color: assignedToId === null ? colors.primaryForeground : colors.foreground }]}>غير مكلّف</Text></Pressable>
        {(officersQuery.data ?? []).filter((officer) => officer.active).map((officer) => <Pressable testID={`task-assignee-${officer.id}`} key={officer.id} disabled={busy || refreshingTaskConflict} onPress={() => { setAssignedToId(officer.id); resetTaskEditReview(); }} style={[styles.option, { backgroundColor: assignedToId === officer.id ? colors.primary : colors.muted }]}><Text allowFontScaling style={[styles.optionText, { color: assignedToId === officer.id ? colors.primaryForeground : colors.foreground }]}>{officer.name}</Text></Pressable>)}
      </View>
      {currentInactiveAssignee ? (
        <View testID="task-assignee-current-inactive" style={[styles.inactiveAssignee, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text allowFontScaling style={[styles.helper, { color: colors.foreground }]}>
            المكلّف المسجّل حاليًا: {currentInactiveAssignee.name} (غير نشط). اختر مكلّفًا نشطًا أدناه أو حدّد «غير مكلّف».
          </Text>
        </View>
      ) : null}
      {officersQuery.isLoading ? <Text allowFontScaling style={[styles.helper, { color: colors.mutedForeground }]}>جارٍ تحميل مسؤولي الأمن…</Text> : null}
      {officersQuery.isError ? (
        <View testID="task-assignees-load-error" accessibilityRole="alert" style={[styles.saveError, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
          <Text allowFontScaling style={[styles.saveErrorMessage, { color: colors.foreground }]}>تعذر تحميل قائمة مسؤولي الأمن.</Text>
          <PrimaryButton
            testID="task-assignees-load-retry"
            label={officersQuery.isFetching ? 'جارٍ إعادة تحميل القائمة…' : 'إعادة تحميل القائمة'}
            icon="refresh"
            disabled={officersQuery.isFetching}
            onPress={() => void officersQuery.refetch()}
          />
        </View>
      ) : null}
      {task ? <>
        <Text allowFontScaling style={[styles.label, { color: colors.foreground }]}>الحالة</Text>
        <View style={styles.options}>{statuses.map(([value, label]) => <Pressable testID={`task-status-${value}`} key={value} disabled={busy || refreshingTaskConflict} onPress={() => { setStatus(value); resetTaskEditReview(); }} style={[styles.option, { backgroundColor: status === value ? colors.primary : colors.muted }]}><Text allowFontScaling style={[styles.optionText, { color: status === value ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>)}</View>
      </> : null}
      {!task && !canManageTaskRecords ? <Text allowFontScaling style={[styles.intro, { color: colors.destructive }]}>لا تملك الصلاحية لإنشاء المهام.</Text> : null}
      </> : null}
      {taskEditConflict && task && canManageTaskRecords ? (
        <View testID="task-edit-conflict" accessibilityRole="alert" style={[styles.saveError, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
          <Text allowFontScaling testID="task-edit-conflict-message" style={[styles.saveErrorMessage, { color: colors.foreground }]}>{saveError ?? 'تعارض في التحديث: تغيّرت البيانات منذ آخر تحميل. راجع أحدث نسخة قبل إعادة المحاولة.'}</Text>
          <Text allowFontScaling style={[styles.saveErrorMessage, { color: colors.foreground }]}>
            احتفظنا بتغييراتك في النموذج. الحقول التي لم تعدّلها ستأخذ قيم أحدث نسخة؛ أما حقولك المعدّلة فستُحفظ فوقها بعد مراجعتك.
          </Text>
          <Text allowFontScaling testID="task-edit-current-title" style={[styles.saveErrorMessage, { color: colors.foreground }]}>العنوان في أحدث نسخة: {task.title}</Text>
          <Text allowFontScaling testID="task-edit-current-description" style={[styles.saveErrorMessage, { color: colors.foreground }]}>التفاصيل في أحدث نسخة: {task.description}</Text>
          <Text allowFontScaling testID="task-edit-current-status" style={[styles.saveErrorMessage, { color: colors.foreground }]}>الحالة في أحدث نسخة: {statuses.find(([value]) => value === task.status)?.[1] ?? task.status}</Text>
          <Text allowFontScaling testID="task-edit-draft-summary" style={[styles.saveErrorMessage, { color: colors.foreground }]}>مسودتك المحفوظة: {title} · {description} · {statuses.find(([value]) => value === status)?.[1] ?? status}</Text>
          {!taskEditConflictLatestLoaded ? (
            <PrimaryButton
              testID="task-edit-refresh-current"
              label={refreshingTaskConflict ? 'جارٍ تحديث المهمة…' : 'تحديث بيانات المهمة'}
              icon="refresh"
              disabled={busy || refreshingTaskConflict}
              onPress={() => void refreshTaskEditConflict()}
            />
          ) : !taskEditConflict.acknowledged ? (
            <>
              <Text allowFontScaling style={[styles.saveErrorMessage, { color: colors.foreground }]}>قارن أحدث نسخة بالمسودة أعلاه. لا يمكن الحفظ حتى تؤكد مراجعتها.</Text>
              <PrimaryButton
                testID="task-edit-review-current"
                label="راجعت النسخة الحالية"
                icon="checkmark"
                disabled={busy}
                onPress={() => setTaskEditConflict((current) => current ? { ...current, acknowledged: true } : current)}
              />
            </>
          ) : (
            <PrimaryButton
              testID="task-edit-retry"
              label="حفظ التغييرات على أحدث نسخة"
              icon="refresh"
              disabled={busy || !valid}
              onPress={() => void save()}
            />
          )}
        </View>
      ) : saveError ? (
        <View testID="task-save-error" accessibilityRole="alert" style={[styles.saveError, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
          <Text allowFontScaling testID="task-save-error-message" style={[styles.saveErrorMessage, { color: colors.foreground }]}>{saveError}</Text>
          <PrimaryButton testID="task-save-error-retry" label="إعادة المحاولة" icon="refresh" disabled={busy} onPress={() => void save()} />
        </View>
      ) : null}
      {canManageTaskRecords ? <PrimaryButton testID="save-task" label={busy ? 'جارٍ الحفظ…' : task ? 'حفظ التعديلات' : 'إنشاء المهمة'} icon="checkmark" disabled={!valid || busy || !canManageTasks || !!taskEditConflict} onPress={() => void save()} /> : null}
      {task && canManageTaskRecords ? <Pressable testID="archive-task" disabled={busy} onPress={() => setArchiveOpen(true)} style={[styles.archive, { borderColor: colors.destructive }]}><Text allowFontScaling style={[styles.archiveText, { color: colors.destructive }]}>أرشفة المهمة</Text></Pressable> : null}

      {showResultForm && (
        <View style={{ marginTop: 24, gap: 12, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text allowFontScaling style={[styles.label, { color: colors.foreground }]}>تقديم نتيجة المهمة</Text>
          <Field testID="task-result-input" label="النتيجة" value={resultText} onChangeText={(value) => { setResultText(value); resetTaskConflictReview('result'); }} multiline />
          <PrimaryButton
            testID="submit-task-result"
            label="تقديم"
            icon="send"
            disabled={!resultText.trim() || submitResultMutation.isPending || resultInFlight.current}
            onPress={() => void submitResult()}
          />
          {renderTaskActionError('result', 'task-result', submitResult, submitResultMutation.isPending || resultInFlight.current)}
        </View>
      )}

      {showApprovalForm && (
        <View style={{ marginTop: 24, gap: 12, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text allowFontScaling style={[styles.label, { color: colors.foreground }]}>اعتماد نتيجة المهمة</Text>
          <Text allowFontScaling style={{ fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: 'right' }}>النتيجة المقدمة: {task.result}</Text>
          <Field testID="task-approval-note" label="ملاحظة الاعتماد (اختياري)" value={approvalNote} onChangeText={(value) => { setApprovalNote(value); resetTaskConflictReview('approval'); }} multiline />
          <PrimaryButton
            testID="approve-task-result"
            label="اعتماد المهمة"
            icon="checkmark-done"
            disabled={approveMutation.isPending || approvalInFlight.current}
            onPress={() => void approveResult()}
          />
          {renderTaskActionError('approval', 'task-approval', approveResult, approveMutation.isPending || approvalInFlight.current)}
        </View>
      )}

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
  inactiveAssignee: { borderWidth: 1, borderRadius: 10, padding: 10 },
  helper: { fontFamily: fonts.regular, textAlign: 'right', marginTop: -8 },
  archive: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, archiveText: { fontFamily: fonts.bold },
  saveError: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  saveErrorMessage: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'right', flexShrink: 1 },
});