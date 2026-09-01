import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Card, Field, fonts, PrimaryButton, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { FamilyHeadNeedInput } from '@workspace/api-client-react';

const categories: Array<[FamilyHeadNeedInput['category'], string]> = [['FOOD', 'غذاء'], ['WATER', 'ماء'], ['MEDICAL', 'طبابة'], ['SHELTER', 'مأوى'], ['HYGIENE', 'نظافة'], ['OTHER', 'أخرى']];
const statusLabels: Record<string, string> = { REQUIRED: 'بانتظار المراجعة', IN_PROGRESS: 'قيد التجهيز', FULFILLED: 'تمت التلبية', CANCELLED: 'ملغى' };
const draftKey = (id: string) => `al-aqsa-family-draft:${id}`;

export default function FamilyHeadScreen() {
  const colors = useColors();
  const { signedInAsFamilyHead, familyProfile, familyNeeds, addFamilyNeed, queuedCount, user } = useApp();
  const ownerId = user?.id ?? '';
  const [draft, setDraft] = useState<FamilyHeadNeedInput>({ category: 'FOOD', title: '', description: '', priority: 'MEDIUM' });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!ownerId) return;
    AsyncStorage.getItem(draftKey(ownerId)).then((value) => { if (value) setDraft(JSON.parse(value) as FamilyHeadNeedInput); }).catch(() => undefined);
  }, [ownerId]);
  const updateDraft = (next: FamilyHeadNeedInput) => {
    setDraft(next);
    if (ownerId) void AsyncStorage.setItem(draftKey(ownerId), JSON.stringify(next));
  };
  const submit = async () => {
    if (draft.title.trim().length < 2) { setMessage('اكتب عنوان الاحتياج أولاً.'); return; }
    setSending(true); setMessage('');
    try {
      const result = await addFamilyNeed({ ...draft, title: draft.title.trim(), description: draft.description?.trim() || undefined });
      updateDraft({ ...draft, title: '', description: '' });
      setMessage(result.queued ? 'حُفظ محلياً وسيُرسل تلقائياً عند عودة الإنترنت.' : 'تم إرسال الطلب بنجاح.');
    } catch { setMessage('تعذر إرسال الطلب. حاول مرة أخرى.'); } finally { setSending(false); }
  };
  const familyCount = useMemo(() => (familyProfile?.members.length ?? 0) + 1, [familyProfile]);
  if (!signedInAsFamilyHead) return <View style={[styles.center, { backgroundColor: colors.surfaceTint }]}><Text style={[styles.title, { color: colors.foreground }]}>هذه الشاشة مخصصة لرب الأسرة.</Text></View>;
  if (!familyProfile) return <View style={[styles.center, { backgroundColor: colors.surfaceTint }]}><Text style={[styles.body, { color: colors.mutedForeground }]}>لا توجد أسرة نشطة مرتبطة بالحساب.</Text></View>;

  return <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
    <ScreenHeader title="ملف أسرتي" subtitle="الاحتياجات والمتابعة" />
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content}>
      <SyncBanner />
      <Card style={{ backgroundColor: colors.accent }}>
        <StatusPill text="أسرة نشطة" tone="green" />
        <Text style={[styles.title, { color: colors.foreground }]}>{familyProfile.headName}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>المخيم: {familyProfile.camp.name} · القطاع: {familyProfile.sector.name}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>الخيمة: {familyProfile.shelter?.code ?? 'غير محددة'} · {familyCount} أفراد</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{familyProfile.delegate ? `المندوب المسؤول: ${familyProfile.delegate.name}` : 'لم يُعيّن مندوب مسؤول بعد.'}</Text>
      </Card>
      <Card><Text style={[styles.section, { color: colors.foreground }]}>أفراد الأسرة</Text>
        {familyProfile.members.map((member) => <View key={member.id} style={[styles.member, { borderBottomColor: colors.border }]}><Text style={[styles.body, { color: colors.foreground }]}>{member.fullName}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{member.relationship}{member.criticalCase ? ' · حالة حرجة' : ''}</Text></View>)}
      </Card>
      <Card><Text style={[styles.section, { color: colors.foreground }]}>إرسال طلب احتياج</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>نوع الاحتياج</Text>
        <View style={styles.chips}>{categories.map(([value, label]) => <Pressable key={value} onPress={() => updateDraft({ ...draft, category: value })} style={[styles.chip, { backgroundColor: draft.category === value ? colors.primary : colors.accent }]}><Text style={[styles.chipText, { color: draft.category === value ? colors.background : colors.foreground }]}>{label}</Text></Pressable>)}</View>
        <Text style={[styles.label, { color: colors.foreground }]}>الأولوية</Text>
        <View style={styles.chips}>{[['LOW', 'منخفضة'], ['MEDIUM', 'متوسطة'], ['HIGH', 'عالية'], ['CRITICAL', 'طارئة']].map(([value, label]) => <Pressable key={value} onPress={() => updateDraft({ ...draft, priority: value as FamilyHeadNeedInput['priority'] })} style={[styles.chip, { backgroundColor: draft.priority === value ? colors.primary : colors.accent }]}><Text style={[styles.chipText, { color: draft.priority === value ? colors.background : colors.foreground }]}>{label}</Text></Pressable>)}</View>
        <Field label="عنوان الطلب" value={draft.title} onChangeText={(title) => updateDraft({ ...draft, title })} placeholder="مثال: حليب أطفال" />
        <Field label="تفاصيل إضافية" value={draft.description ?? ''} onChangeText={(description) => updateDraft({ ...draft, description })} multiline />
        {message ? <Text style={[styles.meta, { color: message.includes('تعذر') ? colors.destructive : colors.mutedForeground }]}>{message}</Text> : null}
        <PrimaryButton testID="family-need-submit" label={sending ? 'جارٍ الإرسال…' : 'إرسال الطلب'} icon="send-outline" disabled={sending} onPress={() => void submit()} />
      </Card>
      <Card><View style={styles.row}><Text style={[styles.section, { color: colors.foreground }]}>طلبات الأسرة</Text>{queuedCount > 0 ? <Ionicons name="cloud-upload-outline" size={22} color={colors.gold} /> : null}</View>
        {familyNeeds.length === 0 ? <Text style={[styles.body, { color: colors.mutedForeground }]}>لم ترسل الأسرة أي طلبات بعد.</Text> : familyNeeds.map((need) => <View key={need.id} style={[styles.need, { borderBottomColor: colors.border }]}><View style={styles.row}><StatusPill text={statusLabels[need.status] ?? need.status} tone={need.status === 'FULFILLED' ? 'green' : 'gold'} /><Text style={[styles.body, { color: colors.foreground }]}>{need.title}</Text></View><Text style={[styles.meta, { color: colors.mutedForeground }]}>{categories.find(([value]) => value === need.category)?.[1]} · {need.history.map((entry) => statusLabels[entry.toStatus]).join(' ← ')}</Text></View>)}
      </Card>
    </KeyboardAwareScrollViewCompat>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 16, paddingBottom: 120, gap: 14 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontFamily: fonts.extraBold, fontSize: 21, textAlign: 'right', marginTop: 10 }, section: { fontFamily: fonts.extraBold, fontSize: 18, textAlign: 'right', marginBottom: 12 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 23, textAlign: 'right', marginTop: 5 }, meta: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'right', marginTop: 6 },
  label: { fontFamily: fonts.bold, textAlign: 'right', marginTop: 8 }, chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginVertical: 6 }, chip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, chipText: { fontFamily: fonts.bold, fontSize: 13 },
  member: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth }, row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, need: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});