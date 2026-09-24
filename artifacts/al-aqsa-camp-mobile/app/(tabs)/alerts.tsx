import {
  ComplaintStatus, TaskStatus, getListComplaintsQueryKey, getListTasksQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, fonts, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getErrorStatus, getMutationErrorMessage } from '@/lib/mutationErrors';

const taskStatus = { PENDING: 'معلّقة', IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'مكتملة', CANCELLED: 'ملغاة' } as const;
const complaintStatus = { OPEN: 'مفتوحة', IN_REVIEW: 'قيد المراجعة', RESOLVED: 'محلولة', REJECTED: 'مرفوضة' } as const;
const priority = { LOW: 'منخفضة', MEDIUM: 'متوسطة', HIGH: 'عالية', URGENT: 'عاجلة' } as const;

export default function AlertsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { complaints, tasks, canManageComplaints, setComplaintStatus, setTaskStatus, retrySync, user } = useApp();
  const taskManagers = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SECURITY_OFFICER';
  const writeLocks = useRef(new Set<string>());
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set());
  const refreshTasks = async () => {
    await queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    await queryClient.refetchQueries({ queryKey: getListTasksQueryKey() });
  };
  const refreshComplaints = async () => {
    await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
    await queryClient.refetchQueries({ queryKey: getListComplaintsQueryKey() });
  };
  const run = async (kind: 'task' | 'complaint', id: string, operation: () => Promise<{ queued: boolean }>) => {
    const lockKey = `${kind}:${id}`;
    if (writeLocks.current.has(lockKey)) return;
    writeLocks.current.add(lockKey);
    setPendingActions((current) => new Set(current).add(lockKey));
    try {
      const result = await operation();
      Alert.alert(result.queued ? 'بانتظار المزامنة' : 'تم التحديث', result.queued ? 'الإجراء معلّق ولم يرسل إلى الخادم بعد.' : 'تمت مزامنة الحالة مع الفريق.');
      if (kind === 'task') await refreshTasks();
      else await refreshComplaints();
    } catch (cause) {
      if (getErrorStatus(cause) === 409) {
        try {
          if (kind === 'task') await refreshTasks();
          else await refreshComplaints();
          await retrySync();
        } catch { /* keep the conflict message as the primary feedback */ }
        Alert.alert('تعارض في التحديث', 'عدّل مستخدم آخر هذا السجل. تم تحميل أحدث نسخة؛ راجعها ثم أعد المحاولة.');
      } else Alert.alert('تعذر التحديث', getMutationErrorMessage(cause));
    } finally {
      writeLocks.current.delete(lockKey);
      setPendingActions((current) => {
        const next = new Set(current);
        next.delete(lockKey);
        return next;
      });
    }
  };
  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="التنبيهات والمهام" subtitle="المهام والشكاوى المشتركة" action={(canManageComplaints || taskManagers) ? <View style={styles.headerActions}>
        {canManageComplaints ? <Pressable testID="add-complaint" onPress={() => router.push('/complaint-form' as never)}><Ionicons name="chatbox-ellipses" size={25} color={colors.primary} /></Pressable> : null}
        {taskManagers ? <Pressable testID="add-task" onPress={() => router.push('/task-form' as never)}><Ionicons name="shield-checkmark" size={27} color={colors.primary} /></Pressable> : null}
      </View> : undefined} />
      <ScrollView contentContainerStyle={styles.content}>
        <SyncBanner />
        <Text style={[styles.section, { color: colors.foreground }]}>المهام الأمنية</Text>
        {tasks.map((task) => (
          <Card key={task.id}>
            <View style={styles.row}>
              <StatusPill text={`${priority[task.priority]} · ${taskStatus[task.status]}`} tone={task.priority === 'URGENT' ? 'red' : 'gold'} />
              <View style={styles.text}><Text style={[styles.title, { color: colors.foreground }]}>{task.title}</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>{task.description} · {task.location}</Text></View>
              <Ionicons name="shield-checkmark-outline" size={25} color={colors.primary} />
            </View>
            {taskManagers ? <View style={styles.manageRow}>
              {task.status !== TaskStatus.COMPLETED ? <Pressable testID={`complete-task-${task.id}`} disabled={pendingActions.has(`task:${task.id}`)} onPress={() => void run('task', task.id, () => setTaskStatus(task.id, TaskStatus.COMPLETED, task.version))}><Text style={[styles.action, { color: colors.primary }]}>تحديد كمكتملة</Text></Pressable> : null}
              <Pressable testID={`edit-task-${task.id}`} onPress={() => router.push({ pathname: '/task-form', params: { id: task.id } } as never)}><Text style={[styles.action, { color: colors.primary }]}>إدارة</Text></Pressable>
            </View> : null}
            {user?.role === 'SECURITY_MEMBER' && task.status !== TaskStatus.COMPLETED ? <View style={styles.manageRow}>
              {task.status === TaskStatus.PENDING ? <Pressable testID={`start-task-${task.id}`} disabled={pendingActions.has(`task:${task.id}`)} onPress={() => void run('task', task.id, () => setTaskStatus(task.id, TaskStatus.IN_PROGRESS, task.version))}><Text style={[styles.action, { color: colors.primary }]}>بدء المهمة</Text></Pressable> : null}
              {task.status === TaskStatus.IN_PROGRESS ? <Pressable testID={`submit-task-result-${task.id}`} onPress={() => router.push({ pathname: '/task-form', params: { id: task.id } } as never)}><Text style={[styles.action, { color: colors.primary }]}>رفع النتيجة</Text></Pressable> : null}
            </View> : null}
          </Card>
        ))}
        <Text style={[styles.section, { color: colors.foreground }]}>الشكاوى</Text>
        {complaints.map((complaint) => (
          <Card key={complaint.id}>
            <View style={styles.row}>
              <StatusPill text={complaintStatus[complaint.status]} tone={complaint.status === 'OPEN' ? 'red' : 'gold'} />
              <View style={styles.text}><Text style={[styles.title, { color: colors.foreground }]}>{complaint.subject}</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>{complaint.complainantName}: {complaint.description}</Text></View>
              <Ionicons name="chatbox-ellipses-outline" size={25} color={colors.primary} />
            </View>
            {canManageComplaints ? <View style={styles.manageRow}>
              {complaint.status !== ComplaintStatus.RESOLVED ? <Pressable testID={`resolve-complaint-${complaint.id}`} disabled={pendingActions.has(`complaint:${complaint.id}`)} onPress={() => void run('complaint', complaint.id, () => setComplaintStatus(complaint.id, ComplaintStatus.RESOLVED, complaint.version))}><Text style={[styles.action, { color: colors.primary }]}>تحديد كمحلولة</Text></Pressable> : null}
              <Pressable testID={`edit-complaint-${complaint.id}`} onPress={() => router.push({ pathname: '/complaint-form', params: { id: complaint.id } } as never)}><Text style={[styles.action, { color: colors.primary }]}>إدارة</Text></Pressable>
            </View> : null}
          </Card>
        ))}
        {!tasks.length && !complaints.length ? <Card><Text style={[styles.body, { color: colors.mutedForeground }]}>لا توجد مهام أو شكاوى في آخر نسخة متاحة.</Text></Card> : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 16, paddingBottom: 118, gap: 12 },
  section: { fontFamily: fonts.extraBold, fontSize: 18, textAlign: 'right', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 }, text: { flex: 1, alignItems: 'flex-end' },
  title: { fontFamily: fonts.bold, fontSize: 16 }, body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'right', marginTop: 3 },
  action: { fontFamily: fonts.bold, textAlign: 'center', paddingTop: 14 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  manageRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', alignItems: 'center' },
});