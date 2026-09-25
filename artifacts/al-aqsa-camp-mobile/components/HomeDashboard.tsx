import { Ionicons } from '@expo/vector-icons';
import { getGetDashboardQueryKey, getListContentQueryKey, useGetDashboard, useListContent } from '@workspace/api-client-react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, SyncBanner } from '@/components/ui';
import { getRoleArabic, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const logo = require('@/assets/images/nazeh-phoenix-logo.png');
type IconName = keyof typeof Ionicons.glyphMap;
type Shortcut = { title: string; detail: string; icon: IconName; route: string; testID?: string };

function ShortcutRow({ item, index }: { item: Shortcut; index: number }) {
  const colors = useColors();
  return (
    <Pressable
      testID={item.testID}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}، ${item.detail}`}
      onPress={() => router.push(item.route as never)}
      style={({ pressed }) => [styles.shortcut, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name="chevron-back" size={17} color={colors.mutedForeground} />
      <View style={styles.shortcutCopy}>
        <Text style={[styles.shortcutTitle, { color: colors.foreground }]}>{item.title}</Text>
        <Text style={[styles.shortcutDetail, { color: colors.mutedForeground }]}>{item.detail}</Text>
      </View>
      <View style={[styles.shortcutIcon, { backgroundColor: index === 0 ? colors.accent : colors.muted }]}>
        <Ionicons name={item.icon} size={22} color={index === 0 ? colors.primary : colors.foreground} />
      </View>
    </Pressable>
  );
}

function Metric({ value, label, icon, large = false }: { value: number; label: string; icon: IconName; large?: boolean }) {
  const colors = useColors();
  return (
    <View testID={`home-metric-${label}`} style={[styles.metric, large && styles.metricLarge, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name={icon} size={large ? 20 : 17} color={colors.primary} />
      <Text style={[styles.metricValue, large && styles.metricValueLarge, { color: colors.foreground }]}>{value.toLocaleString('ar')}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function Announcement({ title, body, imageUrl, createdAt }: { title: string; body: string; imageUrl?: string | null; createdAt: string }) {
  const colors = useColors();
  const [imageFailed, setImageFailed] = useState(false);
  const date = new Date(createdAt);
  return (
    <View style={[styles.announcement, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {imageUrl && !imageFailed ? <Image source={{ uri: imageUrl }} style={styles.announcementImage} resizeMode="cover" onError={() => setImageFailed(true)} accessibilityLabel={title} /> : null}
      <View style={styles.announcementBody}>
        <View style={styles.announcementMeta}>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>{!Number.isNaN(date.getTime()) ? date.toLocaleDateString('ar') : ''}</Text>
          <Text style={[styles.kicker, { color: colors.primary }]}>إعلان عام</Text>
        </View>
        <Text style={[styles.announcementTitle, { color: colors.foreground }]}>{title}</Text>
        <Text numberOfLines={4} style={[styles.announcementText, { color: colors.mutedForeground }]}>{body}</Text>
      </View>
    </View>
  );
}

export default function HomeDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signedIn, authLoading, signedInAsFamilyHead, user, syncState, queuedCount, retrySync, canManageAids, canManagePeople, canManageComplaints, canManageTasks, tasks, complaints, familyNeeds } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const manager = signedIn && (user?.role === 'ADMIN' || user?.role === 'MANAGER');
  const staff = signedIn && !signedInAsFamilyHead;
  const canReadShelters = manager || user?.role === 'DELEGATE' || user?.role === 'SECURITY_OFFICER';
  const dashboardQuery = useGetDashboard({
    query: { enabled: !!manager && !!user?.id, retry: false, queryKey: [...getGetDashboardQueryKey(), user?.id] },
  });
  const contentQuery = useListContent(undefined, {
    query: { enabled: !authLoading, retry: false, queryKey: getListContentQueryKey() },
  });
  const announcements = contentQuery.data?.items?.filter(item => item.status === 'published') ?? [];
  const shortcuts: Shortcut[] = signedInAsFamilyHead
    ? [
        { title: 'ملف أسرتي وطلباتي', detail: 'بيانات الأسرة والاحتياجات', icon: 'people-outline', route: '/family-head', testID: 'home-family-portal' },
      ]
    : staff
      ? [
          ...(canManageAids ? [{ title: 'تسجيل مساعدة', detail: 'إضافة حملة أو توزيع', icon: 'cube-outline' as IconName, route: '/add-aid' }] : []),
          ...(canManagePeople ? [{ title: 'إضافة فرد', detail: 'تحديث سجل النازحين', icon: 'person-add-outline' as IconName, route: '/add-person' }] : []),
          ...(canManageComplaints ? [{ title: 'تسجيل شكوى', detail: 'توثيق ومتابعة الحالة', icon: 'chatbox-ellipses-outline' as IconName, route: '/complaint-form' }] : []),
          ...(canManageTasks && (manager || user?.role === 'SECURITY_OFFICER') ? [{ title: 'تكليف مهمة', detail: 'إسناد عمل للفريق', icon: 'shield-checkmark-outline' as IconName, route: '/task-form' }] : []),
        ]
      : [];
  const sections: Shortcut[] = staff ? [
    ...(canManagePeople ? [{ title: 'العائلات', detail: 'سجلات الأسر', icon: 'home-outline' as IconName, route: '/families' }] : []),
    ...(canManagePeople || canReadShelters ? [{ title: 'الاحتياجات', detail: 'الطلبات القائمة', icon: 'hand-left-outline' as IconName, route: '/needs' }] : []),
    ...(canReadShelters ? [{ title: 'وحدات الإيواء', detail: 'المواقع والإشغال', icon: 'business-outline' as IconName, route: '/shelters', testID: 'home-shelters' }] : []),
    ...(manager ? [{ title: 'التقارير', detail: 'ملخص العمليات', icon: 'bar-chart-outline' as IconName, route: '/reports' }] : []),
    ...(user?.role === 'MANAGER' ? [{ title: 'إدارة الإعلانات', detail: 'نشر تحديث للعائلات', icon: 'megaphone-outline' as IconName, route: '/content' }] : []),
  ] : [];
  const outstandingTasks = tasks.filter(task => task.status === 'PENDING' || task.status === 'IN_PROGRESS').length;
  const openComplaints = complaints.filter(complaint => complaint.status === 'OPEN' || complaint.status === 'IN_REVIEW').length;
  const pendingNeeds = familyNeeds.filter(need => need.status === 'REQUIRED' || need.status === 'APPROVED' || need.status === 'IN_PROGRESS').length;

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        ...(signedIn ? [retrySync()] : []),
        ...(manager ? [dashboardQuery.refetch()] : []),
        contentQuery.refetch(),
      ]);
    } finally { setRefreshing(false); }
  };

  return (
    <View testID="home-dashboard" style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 6, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {signedIn ? (
          <Pressable testID="home-notifications" accessibilityRole="button" accessibilityLabel="الإشعارات" onPress={() => router.push('/notifications' as never)} style={styles.headerAction}>
            <Ionicons name="notifications-outline" size={23} color={colors.foreground} />
            {manager && !!dashboardQuery.data?.unreadNotifications ? <View style={[styles.notificationDot, { backgroundColor: colors.primary }]} /> : null}
          </Pressable>
        ) : <View style={styles.headerAction} />}
        <View style={styles.brandCopy}>
          <Text style={[styles.brandName, { color: colors.foreground }]}>نازح</Text>
          <Text style={[styles.brandSubtitle, { color: colors.mutedForeground }]}>إدارة المخيمات الإنسانية</Text>
        </View>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="شعار نازح والعنقاء" />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void doRefresh()} tintColor={colors.primary} />}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 105 }]}
      >
        <View style={styles.intro}>
          <View style={[styles.introLine, { backgroundColor: colors.primary }]} />
          <View style={styles.introText}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>{signedIn ? getRoleArabic(user?.role ?? '') : 'بوابة المخيم العامة'}</Text>
            <Text style={[styles.greeting, { color: colors.foreground }]}>
              {authLoading ? 'جارٍ تجهيز المساحة…' : signedIn ? `مرحباً${user?.name ? `، ${user.name}` : ''}` : 'أهلاً بك في نازح'}
            </Text>
            <Text style={[styles.introSub, { color: colors.mutedForeground }]}>
              {signedInAsFamilyHead ? 'تابع طلبات أسرتك وآخر مستجدات المخيم.' : staff ? 'ما يحتاج انتباهك اليوم، في مكان واحد.' : 'آخر الإعلانات العامة، وخدمات الأسرة والفريق.'}
            </Text>
          </View>
        </View>

        {signedIn ? <SyncBanner /> : null}
        {signedIn && queuedCount > 0 ? (
          <Pressable testID="home-queue-notice" accessibilityRole="button" onPress={() => router.push('/account' as never)} style={[styles.queueNotice, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={16} color={colors.primary} />
            <Text style={[styles.queueText, { color: colors.foreground }]}>{queuedCount} إجراء بانتظار الإرسال · راجع قائمة المزامنة</Text>
            <Ionicons name="cloud-upload-outline" size={19} color={colors.primary} />
          </Pressable>
        ) : null}

        {!signedIn && !authLoading ? (
          <Pressable testID="home-login" accessibilityRole="button" onPress={() => router.push('/auth/login')} style={({ pressed }) => [styles.login, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="arrow-back" size={19} color={colors.primaryForeground} />
            <Text style={[styles.loginText, { color: colors.primaryForeground }]}>دخول الفريق أو رب الأسرة</Text>
            <Ionicons name="log-in-outline" size={20} color={colors.primaryForeground} />
          </Pressable>
        ) : null}

        {signedIn && shortcuts.length ? (
          <View testID="home-shortcuts" style={styles.block}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{signedInAsFamilyHead ? 'مساحتك' : 'ابدأ العمل'}</Text>
            <View style={styles.list}>{shortcuts.map((item, index) => <ShortcutRow key={item.route} item={item} index={index} />)}</View>
          </View>
        ) : null}

        {manager ? (
          <View testID="home-operations-summary" style={styles.block}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>{syncState === 'synced' ? 'بيانات الخادم' : 'قد لا تكون الأرقام محدثة'}</Text>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>لمحة العمليات</Text>
            </View>
            {dashboardQuery.data ? (
              <>
                <View style={styles.metricRow}>
                  <Metric value={dashboardQuery.data.totalDisplacedPersons} label="فرداً في السجل" icon="people-outline" large />
                  <Metric value={dashboardQuery.data.activeAids} label="مساعدة نشطة" icon="cube-outline" large />
                </View>
                <View style={styles.metricRow}>
                  <Metric value={dashboardQuery.data.openComplaints} label="شكوى مفتوحة" icon="chatbubble-ellipses-outline" />
                  <Metric value={dashboardQuery.data.totalDelegates} label="مندوباً" icon="id-card-outline" />
                  <Metric value={dashboardQuery.data.unreadNotifications} label="إشعاراً جديداً" icon="notifications-outline" />
                </View>
              </>
            ) : dashboardQuery.isError ? (
              <Pressable accessibilityRole="button" onPress={() => void dashboardQuery.refetch()} style={[styles.messageBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="refresh-outline" size={21} color={colors.primary} />
                <Text style={[styles.message, { color: colors.foreground }]}>تعذر تحميل أرقام العمليات. اضغط لإعادة المحاولة.</Text>
              </Pressable>
            ) : <View style={styles.metricRow}><View style={[styles.skeleton, { backgroundColor: colors.muted }]} /><View style={[styles.skeleton, { backgroundColor: colors.muted }]} /></View>}
          </View>
        ) : null}

        {staff && (outstandingTasks > 0 || openComplaints > 0) ? (
          <Pressable testID="home-staff-alert" accessibilityRole="button" onPress={() => router.push('/alerts' as never)} style={[styles.updateRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={17} color={colors.primary} />
            <View style={styles.updateCopy}>
              <Text style={[styles.shortcutTitle, { color: colors.foreground }]}>تحتاج متابعة</Text>
              <Text style={[styles.shortcutDetail, { color: colors.mutedForeground }]}>{outstandingTasks ? `${outstandingTasks} مهام جارية أو معلّقة` : ''}{outstandingTasks && openComplaints ? ' · ' : ''}{openComplaints ? `${openComplaints} شكاوى مفتوحة` : ''}</Text>
            </View>
            <Ionicons name="alert-circle-outline" size={23} color={colors.primary} />
          </Pressable>
        ) : null}
        {signedInAsFamilyHead && pendingNeeds > 0 ? (
          <Pressable testID="home-family-alert" accessibilityRole="button" onPress={() => router.push('/family-head' as never)} style={[styles.updateRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={17} color={colors.primary} />
            <Text style={[styles.shortcutTitle, { color: colors.foreground, flex: 1, textAlign: 'right' }]}>{pendingNeeds} طلبات احتياج قيد الانتظار</Text>
            <Ionicons name="document-text-outline" size={23} color={colors.primary} />
          </Pressable>
        ) : null}

        {sections.length ? <View testID="home-sections" style={styles.block}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>انتقل إلى</Text>
          <View style={styles.list}>{sections.map((item, index) => <ShortcutRow key={item.route} item={item} index={index + 1} />)}</View>
        </View> : null}

        <View style={styles.block}>
          <View style={styles.sectionHeading}>
            <Ionicons name="megaphone-outline" size={19} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>إعلانات المخيم</Text>
          </View>
          {announcements.slice(0, 3).map(item => <Announcement key={item.id} title={item.title} body={item.body} imageUrl={item.imageUrl} createdAt={item.createdAt} />)}
          {!announcements.length ? (
            contentQuery.isLoading ? <View style={[styles.announcementSkeleton, { backgroundColor: colors.muted }]} /> :
            <View style={[styles.messageBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name={contentQuery.isError ? 'cloud-offline-outline' : 'newspaper-outline'} size={22} color={colors.mutedForeground} />
              <Text style={[styles.message, { color: colors.mutedForeground }]}>{contentQuery.isError ? 'تعذر تحميل الإعلانات. اسحب للتحديث أو اضغط لإعادة المحاولة.' : 'لا توجد إعلانات منشورة حالياً.'}</Text>
              {contentQuery.isError ? <Pressable accessibilityRole="button" onPress={() => void contentQuery.refetch()} style={styles.retry}><Text style={[styles.retryText, { color: colors.primary }]}>إعادة المحاولة</Text></Pressable> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerAction: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  notificationDot: { position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: 4 },
  brandCopy: { flex: 1, alignItems: 'flex-end' },
  brandName: { fontFamily: fonts.extraBold, fontSize: 23, lineHeight: 27 },
  brandSubtitle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  logo: { width: 50, height: 50 },
  content: { paddingHorizontal: 17, paddingTop: 22, gap: 17 },
  intro: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'flex-end', gap: 12, paddingVertical: 3 },
  introLine: { width: 3, borderRadius: 2 },
  introText: { flex: 1, alignItems: 'flex-end' },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, textAlign: 'right' },
  greeting: { fontFamily: fonts.extraBold, fontSize: 26, lineHeight: 36, textAlign: 'right', marginTop: 3 },
  introSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'right' },
  block: { gap: 10 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: fonts.extraBold, fontSize: 18, textAlign: 'right' },
  sectionHint: { fontFamily: fonts.medium, fontSize: 11 },
  list: { gap: 7 },
  shortcut: { minHeight: 65, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  shortcutCopy: { flex: 1, alignItems: 'flex-end' },
  shortcutTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, textAlign: 'right' },
  shortcutDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, textAlign: 'right' },
  shortcutIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  login: { minHeight: 54, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loginText: { fontFamily: fonts.bold, fontSize: 15 },
  queueNotice: { minHeight: 46, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  queueText: { fontFamily: fonts.medium, fontSize: 12, flex: 1, textAlign: 'right' },
  metricRow: { flexDirection: 'row-reverse', gap: 7 },
  metric: { flex: 1, minWidth: 0, minHeight: 83, padding: 10, borderWidth: 1, borderRadius: 12, alignItems: 'flex-end', justifyContent: 'space-between' },
  metricLarge: { minHeight: 112, padding: 12 },
  metricValue: { fontFamily: fonts.extraBold, fontSize: 21, lineHeight: 25, textAlign: 'right' },
  metricValueLarge: { fontSize: 28, lineHeight: 32 },
  metricLabel: { fontFamily: fonts.medium, fontSize: 11, textAlign: 'right', lineHeight: 14 },
  skeleton: { flex: 1, height: 112, borderRadius: 12, opacity: 0.6 },
  updateRow: { minHeight: 64, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  updateCopy: { flex: 1, alignItems: 'flex-end' },
  announcement: { borderWidth: 1, borderRadius: 13, overflow: 'hidden' },
  announcementImage: { width: '100%', height: 150 },
  announcementBody: { padding: 14, alignItems: 'flex-end' },
  announcementMeta: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { fontFamily: fonts.bold, fontSize: 11 },
  date: { fontFamily: fonts.medium, fontSize: 11 },
  announcementTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23, textAlign: 'right', marginTop: 8 },
  announcementText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'right', marginTop: 3 },
  announcementSkeleton: { height: 110, borderRadius: 13, opacity: 0.6 },
  messageBox: { minHeight: 85, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 15, gap: 7 },
  message: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 12 },
  retryText: { fontFamily: fonts.bold, fontSize: 13 },
});