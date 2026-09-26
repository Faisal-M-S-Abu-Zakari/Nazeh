import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Card, DataFreshnessNotice, fonts, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getReceivedDistributionCount } from '@/lib/aidPresentation';

export default function OperationsScreen() {
  const colors = useColors();
  const { width, fontScale } = useWindowDimensions();
  const expandedText = width <= 340 || fontScale >= 1.5;
  const { aids, aidsSyncMessage, aidsSyncState, lastAidsSyncAt, retryAids, signedIn, canManageAids } = useApp();
  const recipientCountIsCached = aidsSyncState === 'offline' || aidsSyncState === 'error';
  const recipientCountIsBeingVerified = aidsSyncState === 'syncing';
  const recipientCountLabel = recipientCountIsCached
    ? 'عدد المستلمين (آخر نسخة محفوظة)'
    : recipientCountIsBeingVerified
      ? 'عدد المستلمين (جارٍ التحقق)'
      : 'عدد المستلمين';
  return (
    <View testID="aid-operations-screen" style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader
        title="إدارة المساعدات"
        subtitle="الحملات والتوزيعات"
        action={canManageAids ? <Pressable
          testID="add-aid"
          accessibilityRole="button"
          accessibilityLabel="إضافة مساعدة"
          accessibilityHint="يفتح نموذج تسجيل حملة أو مساعدة جديدة"
          onPress={() => router.push('/add-aid')}
          style={styles.headerAction}
        ><Ionicons name="add-circle" size={27} color={colors.primary} /></Pressable> : undefined}
      />
      <ScrollView contentContainerStyle={[styles.content, expandedText && styles.expandedContent]}>
        <SyncBanner scope="aids" />
        {recipientCountIsCached ? (
          <DataFreshnessNotice
            testID="campaign-recipient-sync-warning"
            title="أعداد المستلمين قديمة"
            message={`${aidsSyncMessage}. الأعداد المعروضة مأخوذة من آخر نسخة محفوظة وقد لا تعكس العدد الحالي على الخادم.`}
            lastSyncedAt={lastAidsSyncAt}
            onRetry={() => void retryAids()}
          />
        ) : null}
        <View style={styles.summary}>
          <StatusPill text={`${aids.length} حملات`} tone="gold" />
          <Text allowFontScaling style={[styles.section, { color: colors.foreground }]}>الحملات الحالية</Text>
        </View>
        {aids.map((aid) => (
          <Pressable
            testID={`open-aid-${aid.id}`}
            key={aid.id}
            accessibilityRole="button"
            accessibilityLabel={`${aid.title}. ${aid.status}. ${aid.type}، ${aid.date}. ${aid.families} عائلة مستفيدة. ${recipientCountLabel}: ${getReceivedDistributionCount(aid)}`}
            accessibilityHint="يفتح تفاصيل الحملة وإجراءاتها"
            onPress={() => router.push({ pathname: '/aid/[id]', params: { id: aid.id } })}
          >
            <Card>
              <View style={styles.row}>
                <StatusPill text={aid.status} tone={aid.status === 'نشطة' ? 'green' : 'gold'} />
                <View style={styles.titleArea}>
                  <Text allowFontScaling style={[styles.title, { color: colors.foreground }]}>{aid.title}</Text>
                  <Text allowFontScaling style={[styles.meta, { color: colors.mutedForeground }]}>{aid.type} · {aid.date}</Text>
                </View>
                <View style={[styles.icon, { backgroundColor: colors.accent }]}>
                  <Ionicons name="cube-outline" size={22} color={colors.primary} />
                </View>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.progress, { backgroundColor: colors.gold, width: `${Math.min(90, aid.families / 1.5)}%` }]} />
              </View>
              <Text allowFontScaling style={[styles.count, { color: colors.primary }]}>{aid.families} عائلة مستفيدة</Text>
              <Text
                allowFontScaling
                testID={`recipient-count-${aid.id}`}
                style={[styles.count, { color: recipientCountIsCached || recipientCountIsBeingVerified ? colors.warning : colors.primary }]}
              >
                {recipientCountLabel}: {getReceivedDistributionCount(aid)}
              </Text>
            </Card>
          </Pressable>
        ))}
        {!signedIn ? <Card><Text allowFontScaling style={[styles.notice, { color: colors.mutedForeground }]}>سجّل الدخول لإضافة حملة أو إدارة قوائم المستفيدين.</Text></Card> : signedIn && !canManageAids ? <Card><Text allowFontScaling style={[styles.notice, { color: colors.destructive }]}>دور حسابك يسمح بالعرض فقط ولا يملك صلاحية إضافة مساعدات.</Text></Card> : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 16, paddingBottom: 118, gap: 12 },
  expandedContent: { paddingBottom: 148 },
  headerAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontFamily: fonts.extraBold, fontSize: 18 }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minWidth: 0 },
  titleArea: { flex: 1, minWidth: 0, alignItems: 'flex-end' }, title: { flexShrink: 1, maxWidth: '100%', fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
  meta: { flexShrink: 1, maxWidth: '100%', fontFamily: fonts.regular, fontSize: 12, marginTop: 3, textAlign: 'right' }, icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 6, borderRadius: 6, overflow: 'hidden', marginTop: 16 }, progress: { height: 6, borderRadius: 6 },
  count: { fontFamily: fonts.medium, textAlign: 'right', marginTop: 8, fontSize: 12 }, notice: { fontFamily: fonts.regular, textAlign: 'center' },
});
