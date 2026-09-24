import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Card, fonts, PrimaryButton, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useGetDashboard, useListContent, getGetDashboardQueryKey, getListContentQueryKey } from '@workspace/api-client-react';

export default function HomeScreen() {
  const colors = useColors();
  const { signedIn, signedInAsFamilyHead, aids, people, retrySync, canManageAids, canManagePeople, user } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const isStaff = signedIn && !signedInAsFamilyHead;
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data: dashboard, refetch: refetchDashboard } = useGetDashboard({
    query: { enabled: isManager, retry: false, queryKey: getGetDashboardQueryKey() }
  });

  const { data: contentData, refetch: refetchContent } = useListContent(undefined, {
    query: { enabled: signedIn, retry: false, queryKey: getListContentQueryKey() }
  });

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await retrySync();
      if (isManager) await refetchDashboard();
      if (signedIn) await refetchContent();
    } finally {
      setRefreshing(false);
    }
  };

  const news = contentData?.items?.filter(c => c.status === 'published') || [];
  const latestNews = news.length > 0 ? news[0] : null;

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="مخيم الأقصى" subtitle="معاً لخدمة أهلنا بكرامة" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={doRefresh} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SyncBanner />

        <LinearGradient
          colors={[colors.primary, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.heroCard, { borderColor: colors.border }]}
        >
          <View style={styles.heroContent}>
            <StatusPill text="الرؤية العامة" tone="gold" />
            <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>مخيم الأقصى - نظام إدارة العمليات</Text>
            <Text style={[styles.body, { color: colors.accent }]}>مرحباً بك في لوحة القيادة. يرجى مراجعة التنبيهات بانتظام ومتابعة المهام.</Text>
          </View>
        </LinearGradient>

        {signedIn && canManagePeople && (
          <View style={styles.actionGrid}>
            <Pressable style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/families' as never)}>
              <Ionicons name="home-outline" size={28} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>العائلات</Text>
            </Pressable>
            <Pressable style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/needs' as never)}>
              <Ionicons name="hand-right-outline" size={28} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>الاحتياجات</Text>
            </Pressable>
            {isManager && (
              <>
                <Pressable style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/reports' as never)}>
                  <Ionicons name="stats-chart-outline" size={28} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.foreground }]}>التقارير</Text>
                </Pressable>
                <Pressable style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/content' as never)}>
                  <Ionicons name="megaphone-outline" size={28} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.foreground }]}>الإعلانات</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {isManager && dashboard && (
          <View style={styles.stats}>
            <Card style={styles.statCard}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}><Ionicons name="home" size={22} color={colors.primary} /></View>
              <Text style={[styles.statValue, { color: colors.primary }]}>{dashboard.totalDisplacedPersons}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>الأفراد</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}><Ionicons name="cube" size={22} color={colors.primary} /></View>
              <Text style={[styles.statValue, { color: colors.primary }]}>{dashboard.activeAids}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>حملات نشطة</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}><Ionicons name="chatbubbles" size={22} color={colors.primary} /></View>
              <Text style={[styles.statValue, { color: colors.primary }]}>{dashboard.openComplaints}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>شكاوى مفتوحة</Text>
            </Card>
          </View>
        )}

        {signedIn && (
          <>
            <View style={styles.sectionTitle}>
              <Text style={[styles.section, { color: colors.foreground }]}>آخر الأخبار</Text>
              <Ionicons name="newspaper-outline" size={20} color={colors.gold} />
            </View>

            {latestNews ? (
              <Card style={styles.newsCard}>
                <View style={styles.newsContent}>
                  <Text style={[styles.newsTitle, { color: colors.foreground }]}>{latestNews.title}</Text>
                  <Text style={[styles.newsBody, { color: colors.mutedForeground }]}>{latestNews.body}</Text>
                  <View style={styles.newsFooter}>
                    <Text style={[styles.date, { color: colors.primary }]}>{new Date(latestNews.createdAt).toLocaleDateString('ar')}</Text>
                  </View>
                </View>
              </Card>
            ) : (
              <Card><Text style={[styles.notice, { color: colors.mutedForeground }]}>لا توجد إعلانات منشورة حالياً.</Text></Card>
            )}
          </>
        )}

        {signedInAsFamilyHead ? (
          <PrimaryButton testID="home-family-portal" label="فتح ملف أسرتي وطلباتها" icon="people-outline" onPress={() => router.push('/family-head' as never)} />
        ) : null}
        {!signedIn ? (
          <PrimaryButton testID="home-login" label="دخول فريق المخيم أو رب الأسرة" icon="log-in-outline" onPress={() => router.push('/auth/login')} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 118, gap: 16 },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heroContent: { padding: 20, alignItems: 'flex-end' },
  heroTitle: { fontFamily: fonts.extraBold, fontSize: 24, textAlign: 'right', marginTop: 16, marginBottom: 8 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 24, textAlign: 'right', opacity: 0.9 },
  actionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  actionText: { fontFamily: fonts.bold, fontSize: 14 },
  stats: { flexDirection: 'row-reverse', gap: 10 },
  statCard: { flex: 1, padding: 14, alignItems: 'center', gap: 6 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontFamily: fonts.extraBold, fontSize: 24 },
  statLabel: { fontFamily: fonts.bold, fontSize: 11, textAlign: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  section: { fontFamily: fonts.extraBold, fontSize: 20, textAlign: 'right' },
  newsCard: { padding: 0, overflow: 'hidden' },
  newsContent: { padding: 16 },
  newsTitle: { fontFamily: fonts.bold, fontSize: 18, textAlign: 'right', marginBottom: 6 },
  newsBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  newsFooter: { flexDirection: 'row-reverse', marginTop: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#0000000A', paddingTop: 12 },
  date: { fontFamily: fonts.bold, fontSize: 12, textAlign: 'right' },
  notice: { fontFamily: fonts.regular, textAlign: 'center' },
});