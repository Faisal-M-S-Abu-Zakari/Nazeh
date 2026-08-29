import { Ionicons } from '@expo/vector-icons';
import {
  Role,
  type StaffUser,
  getListStaffQueryKey,
  useCreateStaff,
  useIssueStaffPasswordReset,
  useListStaff,
  useRenewStaffInvite,
  useUpdateStaff,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Card, Field, fonts, PrimaryButton, ScreenHeader, StatusPill } from '@/components/ui';
import { getRoleArabic, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const roles = [Role.MANAGER, Role.DELEGATE, Role.SECURITY_OFFICER, Role.ADMIN] as const;

export default function StaffManagementScreen() {
  const colors = useColors();
  const { user } = useApp();
  const queryClient = useQueryClient();
  const staffQuery = useListStaff({ query: { queryKey: getListStaffQueryKey(), enabled: user?.role === Role.ADMIN, retry: false } });
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const renewInvite = useRenewStaffInvite();
  const issuePasswordReset = useIssueStaffPasswordReset();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffUser['role']>(Role.DELEGATE);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [tokenTitle, setTokenTitle] = useState('رمز الدعوة');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
  const fail = (text = 'تعذر تنفيذ الإجراء. تحقق من الاتصال والصلاحيات ثم حاول مجدداً.') => {
    setMessage('');
    setError(text);
  };
  const showToken = (token: string, expiresAt: string, title: string) => {
    setError('');
    setInviteToken(token);
    setInviteExpiresAt(expiresAt);
    setTokenTitle(title);
    setMessage('تم إنشاء رمز لمرة واحدة. شاركه مع الموظف عبر قناة آمنة قبل مغادرة الصفحة.');
  };
  const invite = async () => {
    if (name.trim().length < 2 || !email.trim().includes('@')) return fail('أدخل اسماً صحيحاً وبريداً إلكترونياً صالحاً.');
    try {
      const result = await createStaff.mutateAsync({ data: { name: name.trim(), email: email.trim().toLowerCase(), role } });
      setName('');
      setEmail('');
      showToken(result.inviteToken, result.inviteExpiresAt, 'رمز الدعوة');
      await refresh();
    } catch { fail('تعذر إنشاء الدعوة. قد يكون البريد مستخدماً بالفعل.'); }
  };
  const changeRole = async (staff: StaffUser, nextRole: StaffUser['role']) => {
    if (staff.role === nextRole) return;
    try {
      await updateStaff.mutateAsync({ staffId: staff.id, data: { role: nextRole } });
      setError('');
      setMessage(`تم تحديث دور ${staff.name}.`);
      await refresh();
    } catch { fail(); }
  };
  const toggleActive = async (staff: StaffUser) => {
    try {
      await updateStaff.mutateAsync({ staffId: staff.id, data: { active: !staff.active } });
      setError('');
      setMessage(staff.active ? `تم تعطيل حساب ${staff.name}.` : `تمت إعادة تفعيل حساب ${staff.name}.`);
      await refresh();
    } catch { fail(); }
  };
  const reinvite = async (staff: StaffUser) => {
    try {
      const result = await renewInvite.mutateAsync({ staffId: staff.id });
      showToken(result.inviteToken, result.inviteExpiresAt, 'رمز الدعوة الجديد');
      await refresh();
    } catch { fail('لا يمكن إعادة الدعوة إلا لحساب لم يعيّن كلمة مرور بعد.'); }
  };
  const resetPassword = async (staff: StaffUser) => {
    try {
      const result = await issuePasswordReset.mutateAsync({ staffId: staff.id });
      showToken(result.resetToken, result.resetExpiresAt, 'رمز إعادة تعيين كلمة المرور');
      await refresh();
    } catch { fail('لا يمكن إصدار رمز إعادة التعيين لهذا الحساب. تأكد من أن الحساب نشط وقد عيّن كلمة مرور.'); }
  };

  if (user?.role !== Role.ADMIN) {
    return <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}><ScreenHeader title="إدارة الموظفين" subtitle="للمدير فقط" /><View style={styles.denied}><Card><Text style={[styles.heading, { color: colors.foreground }]}>ليس لديك صلاحية لعرض هذه الصفحة.</Text><View style={styles.topGap}><PrimaryButton testID="staff-go-back" label="العودة" icon="arrow-back" onPress={() => router.back()} /></View></Card></View></View>;
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="إدارة الموظفين" subtitle="الدعوات والأدوار وحالة الحساب" action={<Pressable testID="staff-back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={23} color={colors.primaryForeground} /></Pressable>} />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={styles.content}
        bottomOffset={70}
        refreshControl={<RefreshControl refreshing={staffQuery.isRefetching} onRefresh={() => void staffQuery.refetch()} tintColor={colors.primary} />}
      >
        <Card>
          <Text style={[styles.heading, { color: colors.foreground }]}>دعوة موظف جديد</Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>ينشأ الحساب دون كلمة مرور. يعيّنها الموظف بنفسه باستخدام الرمز الآمن.</Text>
          <View style={styles.form}>
            <Field testID="staff-name" label="الاسم" value={name} onChangeText={setName} />
            <Field testID="staff-email" label="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Text style={[styles.label, { color: colors.foreground }]}>الدور</Text>
            <View style={styles.roles}>{roles.map((item) => <RoleButton key={item} role={item} selected={role === item} onPress={() => setRole(item)} />)}</View>
            <PrimaryButton testID="staff-invite-submit" label={createStaff.isPending ? 'جارٍ إنشاء الدعوة…' : 'إنشاء الدعوة'} icon="person-add-outline" disabled={createStaff.isPending || name.trim().length < 2 || !email.includes('@')} onPress={() => void invite()} />
          </View>
        </Card>

        {inviteToken ? <Card style={{ backgroundColor: colors.accent }}>
          <View style={styles.tokenHeading}><Pressable testID="dismiss-invite-token" onPress={() => { setInviteToken(''); setInviteExpiresAt(''); }}><Ionicons name="close-circle" size={24} color={colors.mutedForeground} /></Pressable><Text style={[styles.heading, { color: colors.foreground }]}>{tokenTitle} — يظهر الآن فقط</Text></View>
          <Text selectable testID="invite-token" style={[styles.token, { color: colors.primary, borderColor: colors.gold }]}>{inviteToken}</Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>ينتهي في {new Date(inviteExpiresAt).toLocaleString('ar')}. اضغط مطولاً على الرمز لنسخه، ولا ترسله في قناة عامة.</Text>
        </Card> : null}
        {message ? <Text testID="staff-success" style={[styles.feedback, { color: colors.success }]}>{message}</Text> : null}
        {error ? <Text testID="staff-error" style={[styles.feedback, { color: colors.destructive }]}>{error}</Text> : null}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>أعضاء الفريق</Text>
        {staffQuery.isLoading ? <Card><Text style={[styles.copy, { color: colors.mutedForeground }]}>جارٍ تحميل حسابات الفريق…</Text></Card> : null}
        {staffQuery.isError ? <Card><Text style={[styles.copy, { color: colors.destructive }]}>تعذر تحميل حسابات الفريق.</Text><View style={styles.topGap}><PrimaryButton testID="staff-retry" label="إعادة المحاولة" icon="refresh" onPress={() => void staffQuery.refetch()} /></View></Card> : null}
        {staffQuery.data?.items.map((staff) => (
          <Card key={staff.id}>
            <View style={styles.staffTop}>
              <View style={styles.statuses}><StatusPill text={staff.active ? 'نشط' : 'معطّل'} tone={staff.active ? 'green' : 'red'} />{!staff.passwordSet ? <StatusPill text="بانتظار التعيين" tone="gold" /> : null}</View>
              <View style={styles.staffIdentity}><Text style={[styles.staffName, { color: colors.foreground }]}>{staff.name}</Text><Text style={[styles.email, { color: colors.mutedForeground }]}>{staff.email}</Text></View>
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>تغيير الدور</Text>
            <View style={styles.roles}>{roles.map((item) => <RoleButton key={item} role={item} selected={staff.role === item} disabled={updateStaff.isPending || staff.id === user.id} testID={`staff-${staff.id}-role-${item}`} onPress={() => void changeRole(staff, item)} />)}</View>
            <View style={styles.actions}>
              {!staff.passwordSet ? <Pressable testID={`staff-${staff.id}-reinvite`} disabled={renewInvite.isPending} onPress={() => void reinvite(staff)} style={[styles.action, { borderColor: colors.primary }]}><Text style={[styles.actionText, { color: colors.primary }]}>إعادة الدعوة</Text></Pressable> : null}
              {staff.active && staff.passwordSet ? <Pressable
                testID={`staff-${staff.id}-password-reset`}
                disabled={issuePasswordReset.isPending}
                onPress={() => Alert.alert('إصدار رمز إعادة تعيين', `سيبطل أي رمز إعادة تعيين سابق لحساب ${staff.name}. هل تريد المتابعة؟`, [{ text: 'إلغاء' }, { text: 'إصدار الرمز', style: 'destructive', onPress: () => void resetPassword(staff) }])}
                style={[styles.action, { borderColor: colors.warning }]}
              ><Text style={[styles.actionText, { color: colors.warning }]}>إعادة تعيين المرور</Text></Pressable> : null}
              <Pressable
                testID={`staff-${staff.id}-${staff.active ? 'deactivate' : 'reactivate'}`}
                disabled={updateStaff.isPending || staff.id === user.id}
                onPress={() => Alert.alert(staff.active ? 'تعطيل الحساب' : 'إعادة تفعيل الحساب', `${staff.active ? 'تعطيل' : 'تفعيل'} حساب ${staff.name}؟`, [{ text: 'إلغاء' }, { text: 'تأكيد', style: staff.active ? 'destructive' : 'default', onPress: () => void toggleActive(staff) }])}
                style={[styles.action, { borderColor: staff.active ? colors.destructive : colors.success, opacity: staff.id === user.id ? 0.45 : 1 }]}
              ><Text style={[styles.actionText, { color: staff.active ? colors.destructive : colors.success }]}>{staff.active ? 'تعطيل' : 'إعادة تفعيل'}</Text></Pressable>
            </View>
          </Card>
        ))}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function RoleButton({ role, selected, onPress, disabled, testID }: { role: StaffUser['role']; selected: boolean; onPress: () => void; disabled?: boolean; testID?: string }) {
  const colors = useColors();
  return <Pressable testID={testID ?? `invite-role-${role}`} disabled={disabled} onPress={onPress} style={[styles.role, { backgroundColor: selected ? colors.primary : colors.background, borderColor: selected ? colors.primary : colors.border, opacity: disabled ? 0.5 : 1 }]}><Text style={[styles.roleText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{getRoleArabic(role)}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 16, paddingBottom: 50, gap: 14 }, denied: { padding: 16 },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: fonts.bold, fontSize: 18, textAlign: 'right' }, copy: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, textAlign: 'right', marginTop: 6 },
  form: { gap: 13, marginTop: 16 }, label: { fontFamily: fonts.bold, fontSize: 13, textAlign: 'right', marginTop: 10 },
  roles: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  role: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8 },
  roleText: { fontFamily: fonts.bold, fontSize: 11 },
  tokenHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  token: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, textAlign: 'left', borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12 },
  feedback: { fontFamily: fonts.bold, fontSize: 13, textAlign: 'right', paddingHorizontal: 6 },
  sectionTitle: { fontFamily: fonts.extraBold, fontSize: 20, textAlign: 'right', marginTop: 8 },
  staffTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  staffIdentity: { flex: 1.3, alignItems: 'flex-end' }, staffName: { fontFamily: fonts.bold, fontSize: 17, textAlign: 'right' },
  email: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2, textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', gap: 8, marginTop: 14 },
  action: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.bold, fontSize: 13 }, topGap: { marginTop: 12 },
});