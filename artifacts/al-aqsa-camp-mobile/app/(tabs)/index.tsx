import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, fonts, PrimaryButton, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useState } from 'react';

export default function HomeScreen() {
  const colors = useColors();
  const { signedIn, aids, people, retrySync } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const stats = [
    { label: 'العائلات المستفيدة', value: '٢٧٥', icon: 'people' as const },
    { label: 'حملات جارية', value: String(aids.filter((a) => a.status === 'نشطة').length), icon: 'cube' as const },
    { label: 'أفراد مسجلون', value: String(people.length), icon: 'id-card' as const },
  ];
  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="مخيم الأقصى" subtitle="معاً لخدمة أهلنا بكرامة" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={() => { setRefreshing(true); retrySync().finally(() => setRefreshing(false)); }} />}
        contentContainerStyle={styles.content}
      >
        <SyncBanner />
        <Card style={{ backgroundColor: colors.accent }}>
          <StatusPill text="تحديث ميداني" tone="gold" />
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>توزيع السلال الغذائية مستمر اليوم</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>بدأت الفرق منذ الثامنة صباحاً بخدمة المربعات أ، ب، وج. يرجى إبراز بطاقة العائلة.</Text>
        </Card>
        <View style={styles.stats}>
          {stats.map((stat) => (
            <Card key={stat.label} style={styles.statCard}>
              <Ionicons name={stat.icon} size={22} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.primary }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </Card>
          ))}
        </View>
        <View style={styles.sectionTitle}>
          <Text style={[styles.section, { color: colors.foreground }]}>آخر الأخبار</Text>
          <Ionicons name="newspaper-outline" size={20} color={colors.gold} />
        </View>
        <Card>
          <Text style={[styles.newsTitle, { color: colors.foreground }]}>افتتاح نقطة رعاية صحية جديدة</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>تستقبل النقطة الحالات يومياً من التاسعة صباحاً حتى الثالثة عصراً.</Text>
          <Text style={[styles.date, { color: colors.primary }]}>منذ ساعتين</Text>
        </Card>
        <Card>
          <Text style={[styles.newsTitle, { color: colors.foreground }]}>قصة نجاح: مبادرة مطبخ الحي</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>خمسة عشر متطوعة يجهزن وجبات ساخنة لكبار السن يومياً.</Text>
          <Text style={[styles.date, { color: colors.primary }]}>أمس</Text>
        </Card>
        {!signedIn ? <PrimaryButton testID="home-login" label="دخول فريق المخيم" icon="log-in-outline" onPress={() => router.push('/auth/login')} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 118, gap: 14 },
  heroTitle: { fontFamily: fonts.extraBold, fontSize: 21, textAlign: 'right', marginTop: 12 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 23, textAlign: 'right', marginTop: 6 },
  stats: { flexDirection: 'row-reverse', gap: 8 },
  statCard: { flex: 1, padding: 11, alignItems: 'flex-end', gap: 3 },
  statValue: { fontFamily: fonts.extraBold, fontSize: 22 },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, textAlign: 'right' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  section: { fontFamily: fonts.extraBold, fontSize: 19, textAlign: 'right' },
  newsTitle: { fontFamily: fonts.bold, fontSize: 17, textAlign: 'right' },
  date: { fontFamily: fonts.medium, fontSize: 12, textAlign: 'right', marginTop: 10 },
});
