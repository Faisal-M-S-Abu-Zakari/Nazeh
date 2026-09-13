import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, fonts, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function OperationsScreen() {
  const colors = useColors();
  const { aids, signedIn, canManageAids } = useApp();
  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader
        title="إدارة المساعدات"
        subtitle="الحملات والتوزيعات"
        action={canManageAids ? <Pressable testID="add-aid" onPress={() => router.push('/add-aid')}><Ionicons name="add-circle" size={31} color={colors.primary} /></Pressable> : undefined}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <SyncBanner />
        <View style={styles.summary}>
          <StatusPill text={`${aids.length} حملات`} tone="gold" />
          <Text style={[styles.section, { color: colors.foreground }]}>الحملات الحالية</Text>
        </View>
        {aids.map((aid) => (
          <Pressable testID={`open-aid-${aid.id}`} key={aid.id} onPress={() => router.push({ pathname: '/aid/[id]', params: { id: aid.id } })}>
            <Card>
              <View style={styles.row}>
                <StatusPill text={aid.status} tone={aid.status === 'نشطة' ? 'green' : 'gold'} />
                <View style={styles.titleArea}>
                  <Text style={[styles.title, { color: colors.foreground }]}>{aid.title}</Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>{aid.type} · {aid.date}</Text>
                </View>
                <View style={[styles.icon, { backgroundColor: colors.accent }]}>
                  <Ionicons name="cube-outline" size={22} color={colors.primary} />
                </View>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.progress, { backgroundColor: colors.gold, width: `${Math.min(90, aid.families / 1.5)}%` }]} />
              </View>
              <Text style={[styles.count, { color: colors.primary }]}>{aid.families} عائلة مستفيدة</Text>
            </Card>
          </Pressable>
        ))}
        {!signedIn ? <Card><Text style={[styles.notice, { color: colors.mutedForeground }]}>سجّل الدخول لإضافة حملة أو إدارة قوائم المستفيدين.</Text></Card> : signedIn && !canManageAids ? <Card><Text style={[styles.notice, { color: colors.destructive }]}>دور حسابك يسمح بالعرض فقط ولا يملك صلاحية إضافة مساعدات.</Text></Card> : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 16, paddingBottom: 118, gap: 12 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontFamily: fonts.extraBold, fontSize: 18 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleArea: { flex: 1, alignItems: 'flex-end' }, title: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
  meta: { fontFamily: fonts.regular, fontSize: 12, marginTop: 3 }, icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 6, borderRadius: 6, overflow: 'hidden', marginTop: 16 }, progress: { height: 6, borderRadius: 6 },
  count: { fontFamily: fonts.medium, textAlign: 'right', marginTop: 8, fontSize: 12 }, notice: { fontFamily: fonts.regular, textAlign: 'center' },
});