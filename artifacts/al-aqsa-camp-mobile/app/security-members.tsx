import { Ionicons } from '@expo/vector-icons';
import { Role, getListSecurityMembersQueryKey, useListSecurityMembers } from '@workspace/api-client-react';
import { router } from 'expo-router';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, fonts, PrimaryButton, ScreenHeader, StatusPill } from '@/components/ui';
import { getRoleArabic, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const securityLeadRoles = [Role.ADMIN, Role.MANAGER, Role.SECURITY_OFFICER] as const;

export default function SecurityMembersScreen() {
  const colors = useColors();
  const { user, signedIn } = useApp();
  const canViewSecurityMembers = !!user && securityLeadRoles.some((role) => user.role === role);
  const canManageStaff = user?.role === Role.ADMIN || user?.role === Role.MANAGER;
  const membersQuery = useListSecurityMembers({
    query: {
      enabled: signedIn && canViewSecurityMembers,
      queryKey: getListSecurityMembersQueryKey(),
      retry: false,
    },
  });

  if (!canViewSecurityMembers) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="أعضاء الأمن" subtitle="بيانات فريق الأمن" />
        <View style={styles.content}>
          <Card style={styles.center}>
            <Text style={[styles.message, { color: colors.destructive }]}>ليس لديك صلاحية لعرض بيانات فريق الأمن.</Text>
            <View style={styles.topGap}>
              <PrimaryButton testID="security-members-go-back" label="العودة" icon="arrow-back" onPress={() => router.back()} />
            </View>
          </Card>
        </View>
      </View>
    );
  }

  const members = membersQuery.data ?? [];

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader
        title="أعضاء الأمن"
        subtitle="المسؤولون وأعضاء الأمن"
        action={
          <Pressable
            testID="security-members-back"
            accessibilityRole="button"
            accessibilityLabel="العودة"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Ionicons name="arrow-back" size={23} color={colors.foreground} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, Platform.OS === 'web' ? styles.webBottomInset : undefined]}
        refreshControl={
          <RefreshControl
            refreshing={membersQuery.isFetching && !membersQuery.isLoading}
            onRefresh={() => void membersQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Card>
          <Text style={[styles.heading, { color: colors.foreground }]}>إدارة فريق الأمن</Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>
            تعرض هذه القائمة حسابات مسؤول الأمن وأعضاء الأمن المسجلة على الخادم.
          </Text>
          {canManageStaff ? (
            <View style={styles.topGap}>
              <PrimaryButton
                testID="security-members-manage-staff"
                label="إدارة الدعوات والأدوار"
                icon="people-outline"
                onPress={() => router.push('/staff-management' as never)}
              />
            </View>
          ) : null}
        </Card>

        {membersQuery.isLoading ? (
          <Card>
            <Text accessibilityLiveRegion="polite" style={[styles.copy, { color: colors.mutedForeground }]}>جارٍ تحميل بيانات فريق الأمن…</Text>
          </Card>
        ) : null}

        {membersQuery.isError ? (
          <Card>
            <Text testID="security-members-error" accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>
              تعذر تحميل بيانات فريق الأمن. تحقق من الاتصال والصلاحية ثم أعد المحاولة.
            </Text>
            <View style={styles.topGap}>
              <PrimaryButton
                testID="security-members-retry"
                label="إعادة المحاولة"
                icon="refresh"
                disabled={membersQuery.isFetching}
                onPress={() => void membersQuery.refetch()}
              />
            </View>
          </Card>
        ) : null}

        {!membersQuery.isLoading && !membersQuery.isError && members.length === 0 ? (
          <Card style={styles.center}>
            <Ionicons name="people-outline" size={30} color={colors.mutedForeground} />
            <Text style={[styles.message, { color: colors.mutedForeground }]}>لا توجد حسابات أمن مسجلة حالياً.</Text>
            {canManageStaff ? (
              <View style={styles.topGap}>
                <PrimaryButton
                  testID="security-members-invite-empty"
                  label="دعوة عضو أمن"
                  icon="person-add-outline"
                  onPress={() => router.push('/staff-management' as never)}
                />
              </View>
            ) : null}
          </Card>
        ) : null}

        {!membersQuery.isLoading && !membersQuery.isError ? members.map((member) => (
          <View key={member.id} testID={`security-member-${member.id}`}>
            <Card>
              <View style={styles.memberTop}>
                <StatusPill text={member.active ? 'نشط' : 'معطّل'} tone={member.active ? 'green' : 'red'} />
                <View style={styles.identity}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{member.name}</Text>
                  <Text selectable style={[styles.email, { color: colors.mutedForeground }]}>{member.email}</Text>
                </View>
              </View>
              <View style={styles.roleRow}>
                <StatusPill text={getRoleArabic(member.role)} tone={member.role === Role.SECURITY_OFFICER ? 'gold' : 'green'} />
              </View>
            </Card>
          </View>
        )) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  webBottomInset: { paddingBottom: 58 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  message: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23, textAlign: 'right' },
  heading: { fontFamily: fonts.bold, fontSize: 18, textAlign: 'right' },
  copy: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, textAlign: 'right', marginTop: 8 },
  topGap: { marginTop: 14 },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  memberTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  identity: { flex: 1, alignItems: 'flex-end' },
  name: { fontFamily: fonts.bold, fontSize: 17, textAlign: 'right' },
  email: { fontFamily: fonts.regular, fontSize: 13, marginTop: 3, textAlign: 'right' },
  roleRow: { alignItems: 'flex-end', marginTop: 12 },
});