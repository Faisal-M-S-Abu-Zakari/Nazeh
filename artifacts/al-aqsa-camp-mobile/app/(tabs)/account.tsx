import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TaskStatus } from '@workspace/api-client-react';
import { useState } from 'react';
import { Card, fonts, PrimaryButton, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { getRoleArabic, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const taskStatusLabel: Record<TaskStatus, string> = {
  PENDING: 'معلّقة',
  IN_PROGRESS: 'قيد التنفيذ',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
};

export default function AccountScreen() {
  const colors = useColors();
  const { signedIn, authLoading, signOut, user, queuedCount, pendingWrites, tasks, retrySync, discardQueuedWrite, reviewTaskConflict } = useApp();
  const [reviewError, setReviewError] = useState<string | null>(null);
  const reviewConflict = async (id: string) => {
    setReviewError(null);
    try {
      await reviewTaskConflict(id);
      router.push('/alerts' as never);
    } catch {
      setReviewError('تعذر تحديث حالة المهمة. تحقّق من الاتصال ثم راجعها مجدداً.');
    }
  };
  const requestSignOut = () => {
    if (Platform.OS === 'web') {
      void signOut();
      return;
    }
    Alert.alert(
      'تسجيل الخروج',
      user?.role === 'DISPLACED'
        ? 'سيتم مسح الجلسة والطلبات المعلّقة. ستبقى نسخة سجل المساعدات للقراءة بعد تسجيل الدخول بالحساب نفسه فقط.'
        : 'سيتم مسح بيانات الحساب ونسخة القراءة المحفوظة من هذا الهاتف.',
      [{ text: 'إلغاء' }, { text: 'خروج', style: 'destructive', onPress: () => void signOut() }],
    );
  };
  const pendingLabel = (item: typeof pendingWrites[number]) => {
    if (item.kind === 'aid') return `إضافة حملة: ${item.data.title}`;
    if (item.kind === 'person') return `إضافة سجل: ${item.data.fullName}`;
    if (item.kind === 'complaint-create') return `إضافة شكوى: ${item.data.subject}`;
    if (item.kind === 'task-create') return `إضافة مهمة: ${item.data.title}`;
    if (item.kind === 'task') {
      const taskTitle = tasks.find((task) => task.id === item.targetId)?.title ?? item.conflict?.title;
      return `تحديث المهمة: ${taskTitle ?? item.targetId}`;
    }
    return item.kind === 'complaint' ? `تحديث شكوى: ${item.status}` : `طلب احتياج: ${item.data.title}`;
  };
  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="الحساب" subtitle="إعدادات فريق المخيم" />
      <ScrollView contentContainerStyle={styles.content}>
        {signedIn ? (
          <>
            <SyncBanner />
            <Card>
              <View style={styles.profile}>
                <View style={styles.profileText}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{user?.name || 'حساب الفريق'}</Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>{user ? getRoleArabic(user.role) : 'جارٍ تحميل الحساب…'} · {user?.email}</Text>
                  <StatusPill text={queuedCount ? `${queuedCount} إجراء معلّق` : 'حساب متزامن'} tone={queuedCount ? 'gold' : 'green'} />
                </View>
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}><Ionicons name="person" size={32} color={colors.primary} /></View>
              </View>
            </Card>
            <Card><Text style={[styles.heading, { color: colors.foreground }]}>المزامنة المشتركة</Text><Text style={[styles.copy, { color: colors.mutedForeground }]}>تتم مزامنة بيانات العمليات مع الخادم وأجهزة الفريق. تتوفر آخر نسخة ناجحة للقراءة عند انقطاع الاتصال.</Text></Card>
            {user?.role === 'ADMIN' || user?.role === 'MANAGER' ? <Card>
              <Text style={[styles.heading, { color: colors.foreground }]}>إدارة فريق العمل</Text>
              <Text style={[styles.copy, { color: colors.mutedForeground }]}>دعوة الموظفين وتعديل الأدوار وحالة الحسابات دون مشاركة كلمات المرور.</Text>
              <View style={styles.gap}><PrimaryButton testID="open-staff-management" label="إدارة الموظفين" icon="people-outline" onPress={() => router.push('/staff-management' as never)} /></View>
            </Card> : null}
            {user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'SECURITY_OFFICER' ? <Card>
              <Text style={[styles.heading, { color: colors.foreground }]}>فريق الأمن</Text>
              <Text style={[styles.copy, { color: colors.mutedForeground }]}>عرض حسابات مسؤول الأمن وأعضاء الأمن وحالة حساباتهم.</Text>
              <View style={styles.gap}><PrimaryButton testID="open-security-members" label="أعضاء الأمن" icon="shield-checkmark-outline" onPress={() => router.push('/security-members' as never)} /></View>
            </Card> : null}
            {pendingWrites.length ? <Card>
              <Text style={[styles.heading, { color: colors.foreground }]}>إجراءات بانتظار المزامنة</Text>
              {reviewError ? <Text testID="task-conflict-review-error" accessibilityRole="alert" style={[styles.pendingState, { color: colors.destructive }]}>{reviewError}</Text> : null}
              {pendingWrites.map((item) => {
                const taskConflict = item.kind === 'task' ? item.conflict : undefined;
                return (
                  <View key={item.id} style={[styles.pending, { borderTopColor: colors.border }]}>
                    <View style={styles.pendingText}>
                      <Text style={[styles.meta, { color: colors.foreground }]}>{pendingLabel(item)}</Text>
                      {taskConflict ? <>
                        <Text style={[styles.pendingState, { color: colors.warning }]}>تغيّرت هذه المهمة على جهاز آخر. لم يُعَد إرسال التغيير القديم.</Text>
                        <Text style={[styles.pendingState, { color: colors.foreground }]}>{taskConflict.refreshed
                          ? taskConflict.status
                            ? `أحدث حالة: ${taskStatusLabel[taskConflict.status]} · الإصدار ${taskConflict.version}`
                            : 'لم تعد المهمة ظاهرة ضمن المهام المتاحة.'
                          : 'تعذر تحميل أحدث حالة؛ راجعها قبل إنشاء أي تغيير جديد.'}</Text>
                      </> : <Text style={[styles.pendingState, { color: colors.warning }]}>بانتظار الإرسال إلى الخادم</Text>}
                    </View>
                    <Pressable testID={`discard-pending-${item.id}`} onPress={() => void discardQueuedWrite(item.id)}><Text style={[styles.pendingAction, { color: colors.destructive }]}>حذف</Text></Pressable>
                    {taskConflict
                      ? <Pressable testID={`review-pending-task-${item.id}`} onPress={() => void reviewConflict(item.id)}><Text style={[styles.pendingAction, { color: colors.primary }]}>مراجعة الحالة</Text></Pressable>
                      : <Pressable testID={`retry-pending-${item.id}`} onPress={() => void retrySync()}><Text style={[styles.pendingAction, { color: colors.primary }]}>إعادة المحاولة</Text></Pressable>}
                  </View>
                );
              })}
            </Card> : null}
            <PrimaryButton testID="account-logout" label="تسجيل الخروج" icon="log-out-outline" onPress={requestSignOut} />
          </>
        ) : authLoading ? (
          <Card><Text style={[styles.copy, { color: colors.mutedForeground }]}>جارٍ التحقق من جلسة الحساب ومزامنة بياناته…</Text></Card>
        ) : (
          <Card>
            <Ionicons name="lock-closed-outline" size={36} color={colors.primary} style={styles.lock} />
            <Text style={[styles.heading, { color: colors.foreground }]}>دخول فريق المخيم</Text>
            <Text style={[styles.copy, { color: colors.mutedForeground }]}>ادخل للوصول إلى بيانات الفريق المشتركة ومزامنة الإجراءات.</Text>
            <View style={styles.gap}><PrimaryButton testID="account-login" label="تسجيل الدخول" icon="log-in-outline" onPress={() => router.push('/auth/login')} /></View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 16, paddingBottom: 118, gap: 14 },
  profile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14 },
  profileText: { flex: 1, alignItems: 'flex-end', gap: 5 }, avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.extraBold, fontSize: 20 }, meta: { fontFamily: fonts.regular, fontSize: 14 },
  heading: { fontFamily: fonts.bold, fontSize: 18, textAlign: 'right' }, copy: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, textAlign: 'right', marginTop: 8 },
  lock: { alignSelf: 'center', marginBottom: 12 }, gap: { marginTop: 18 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  pendingText: { flex: 1, alignItems: 'flex-end' }, pendingState: { fontFamily: fonts.medium, fontSize: 11, marginTop: 3 },
  pendingAction: { fontFamily: fonts.bold, fontSize: 12, padding: 4 },
});
