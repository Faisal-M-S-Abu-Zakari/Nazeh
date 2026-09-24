import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Card, Field, fonts, PrimaryButton, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { FamilyHeadNeedInput } from '@workspace/api-client-react';
import { useListNotifications, useListContent, useListComplaints, useMarkNotificationRead, useGetFamilyMeAidDistributions, getGetFamilyMeAidDistributionsQueryKey, getListNotificationsQueryKey, getListContentQueryKey, getListComplaintsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const categories: Array<[FamilyHeadNeedInput['category'], string]> = [['FOOD', 'غذاء'], ['WATER', 'ماء'], ['MEDICAL', 'طبابة'], ['SHELTER', 'مأوى'], ['HYGIENE', 'نظافة'], ['OTHER', 'أخرى']];
const statusLabels: Record<string, string> = { REQUIRED: 'بانتظار المراجعة', APPROVED: 'موافق عليه', IN_PROGRESS: 'قيد التجهيز', FULFILLED: 'تمت التلبية', CANCELLED: 'ملغى' };
const draftKey = (id: string) => `al-aqsa-family-draft:${id}`;

export default function FamilyHeadScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { signedInAsFamilyHead, familyProfile, familyNeeds, addFamilyNeed, queuedCount, user } = useApp();
  const ownerId = user?.id ?? '';
  const [draft, setDraft] = useState<FamilyHeadNeedInput>({ category: 'FOOD', title: '', description: '', priority: 'MEDIUM' });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const { data: notificationsPage } = useListNotifications(undefined, { query: { enabled: signedInAsFamilyHead, queryKey: getListNotificationsQueryKey() } });
  const { data: contentPage } = useListContent(undefined, { query: { enabled: signedInAsFamilyHead, queryKey: getListContentQueryKey() } });
  const { data: complaintsPage } = useListComplaints({ query: { enabled: signedInAsFamilyHead, queryKey: getListComplaintsQueryKey() } });
  const receivedAids = useGetFamilyMeAidDistributions({
    query: {
      enabled: signedInAsFamilyHead && !!familyProfile && !!ownerId,
      queryKey: [...getGetFamilyMeAidDistributionsQueryKey(), ownerId],
      retry: false,
    },
  });

  const notifications = notificationsPage?.items || [];
  const announcements = contentPage?.items?.filter(c => c.status === 'published') || [];
  const complaints = complaintsPage || [];

  const markReadMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() })
    }
  });

  const handleReadNotif = (id: number, read: boolean) => {
    if (!read) markReadMutation.mutate({ id, data: { read: true } });
  };

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

      {/* Announcements */}
      {announcements.length > 0 && (
        <Card style={{ backgroundColor: colors.accent }}>
          <View style={styles.row}><Text style={[styles.section, { color: colors.foreground, marginBottom: 0 }]}>إعلانات المخيم</Text><Ionicons name="megaphone-outline" size={20} color={colors.primary} /></View>
          {announcements.map(ann => (
            <View key={ann.id} style={{ marginTop: 8 }}>
              <Text style={[styles.label, { color: colors.foreground, marginTop: 0 }]}>{ann.title}</Text>
              <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 2 }]}>{ann.body}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card>
          <View style={styles.row}><Text style={[styles.section, { color: colors.foreground, marginBottom: 0 }]}>الإشعارات</Text><Ionicons name="notifications-outline" size={20} color={colors.primary} /></View>
          {notifications.map(notif => (
            <Pressable key={notif.id} style={[styles.need, { borderBottomColor: colors.border }]} onPress={() => handleReadNotif(notif.id, notif.read)}>
              <View style={styles.row}>
                {!notif.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                <Text style={[styles.body, { color: colors.foreground, flex: 1, fontFamily: notif.read ? fonts.regular : fonts.bold }]}>{notif.title}</Text>
              </View>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{notif.message}</Text>
            </Pressable>
          ))}
        </Card>
      )}

      {/* Profile */}
      <Card>
        <StatusPill text="أسرة نشطة" tone="green" />
        <Text style={[styles.title, { color: colors.foreground }]}>{familyProfile.headName}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>المخيم: {familyProfile.camp.name} · القطاع: {familyProfile.sector.name}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>الخيمة: {familyProfile.shelter?.code ?? 'غير محددة'} · {familyCount} أفراد</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{familyProfile.delegate ? `المندوب المسؤول: ${familyProfile.delegate.name}` : 'لم يُعيّن مندوب مسؤول بعد.'}</Text>
      </Card>

      {/* Needs Form */}
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

      {/* Family Needs List */}
      <Card><View style={styles.row}><Text style={[styles.section, { color: colors.foreground }]}>طلبات الأسرة</Text>{queuedCount > 0 ? <Ionicons name="cloud-upload-outline" size={22} color={colors.gold} /> : null}</View>
        {familyNeeds.length === 0 ? <Text style={[styles.body, { color: colors.mutedForeground }]}>لم ترسل الأسرة أي طلبات بعد.</Text> : familyNeeds.map((need) => <View key={need.id} style={[styles.need, { borderBottomColor: colors.border }]}><View style={styles.row}><StatusPill text={statusLabels[need.status] ?? need.status} tone={need.status === 'FULFILLED' ? 'green' : 'gold'} /><Text style={[styles.body, { color: colors.foreground, flex: 1, textAlign: 'right' }]}>{need.title}</Text></View><Text style={[styles.meta, { color: colors.mutedForeground }]}>{categories.find(([value]) => value === need.category)?.[1]} · {(need as any).history ? (need as any).history.map((entry: any) => statusLabels[entry.toStatus]).join(' ← ') : 'لا يوجد سجل'}</Text></View>)}
      </Card>

      {/* Complaints List */}
      {complaints.length > 0 && (
        <Card><Text style={[styles.section, { color: colors.foreground }]}>الشكاوى السابقة</Text>
          {complaints.map((c) => (
             <View key={c.id} style={[styles.need, { borderBottomColor: colors.border }]}>
               <View style={styles.row}><StatusPill text={c.status} tone={c.status === 'RESOLVED' ? 'green' : 'gold'} /><Text style={[styles.body, { color: colors.foreground, flex: 1, textAlign: 'right' }]}>{c.subject}</Text></View>
               {c.reply && <Text style={[styles.meta, { color: colors.primary, marginTop: 4 }]}>الرد: {c.reply}</Text>}
             </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={[styles.section, { color: colors.foreground }]}>المساعدات المستلمة</Text>
        {receivedAids.isPending ? (
          <View style={styles.row}><ActivityIndicator color={colors.primary} /><Text style={[styles.body, { color: colors.mutedForeground }]}>جارٍ تحميل سجل المساعدات…</Text></View>
        ) : receivedAids.isError ? (
          <View>
            <Text style={[styles.body, { color: colors.destructive }]}>تعذر تحميل سجل المساعدات. تحقق من الاتصال وحاول مجدداً.</Text>
            <PrimaryButton testID="family-aids-retry" label="إعادة المحاولة" icon="refresh-outline" onPress={() => void receivedAids.refetch()} />
          </View>
        ) : receivedAids.data?.length ? receivedAids.data.map((aid) => (
          <View key={aid.id} style={[styles.need, { borderBottomColor: colors.border }]}>
            <View style={styles.row}>
              <StatusPill text="مستلمة" tone="green" />
              <Text style={[styles.body, { color: colors.foreground, flex: 1, textAlign: 'right', fontFamily: fonts.bold }]}>{aid.title}</Text>
            </View>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {categories.find(([type]) => type === aid.type)?.[1] ?? aid.type} · {aid.quantity} {aid.unit} · {new Date(aid.deliveredAt).toLocaleDateString('ar')}
            </Text>
          </View>
        )) : <Text style={[styles.body, { color: colors.mutedForeground }]}>لم تستلم الأسرة أي مساعدات بعد.</Text>}
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
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
});