import { ComplaintStatus, TaskStatus } from '@workspace/api-client-react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, fonts, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const taskStatus = { PENDING: 'معلّقة', IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'مكتملة', CANCELLED: 'ملغاة' } as const;
const complaintStatus = { OPEN: 'مفتوحة', IN_REVIEW: 'قيد المراجعة', RESOLVED: 'محلولة', REJECTED: 'مرفوضة' } as const;
const priority = { LOW: 'منخفضة', MEDIUM: 'متوسطة', HIGH: 'عالية', URGENT: 'عاجلة' } as const;

export default function AlertsScreen() {
  const colors = useColors();
  const { complaints, tasks, canManageComplaints, canManageTasks, setComplaintStatus, setTaskStatus } = useApp();
  const run = async (operation: () => Promise<{ queued: boolean }>) => {
    try {
      const result = await operation();
      Alert.alert(result.queued ? 'بانتظار المزامنة' : 'تم التحديث', result.queued ? 'الإجراء معلّق ولم يرسل إلى الخادم بعد.' : 'تمت مزامنة الحالة مع الفريق.');
    } catch (cause) { Alert.alert('تعذر التحديث', cause instanceof Error ? cause.message : 'حدث خطأ غير متوقع.'); }
  };
  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="التنبيهات والمهام" subtitle="المهام والشكاوى المشتركة" />
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
            {canManageTasks && task.status !== TaskStatus.COMPLETED ? <Pressable testID={`complete-task-${task.id}`} onPress={() => void run(() => setTaskStatus(task.id, TaskStatus.COMPLETED, task.version))}><Text style={[styles.action, { color: colors.primary }]}>تحديد كمكتملة</Text></Pressable> : null}
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
            {canManageComplaints && complaint.status !== ComplaintStatus.RESOLVED ? <Pressable testID={`resolve-complaint-${complaint.id}`} onPress={() => void run(() => setComplaintStatus(complaint.id, ComplaintStatus.RESOLVED, complaint.version))}><Text style={[styles.action, { color: colors.primary }]}>تحديد كمحلولة</Text></Pressable> : null}
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
});