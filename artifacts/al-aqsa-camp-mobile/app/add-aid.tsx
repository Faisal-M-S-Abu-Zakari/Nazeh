import { AidType, type CreateAidRequest } from '@workspace/api-client-react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Field, fonts, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const types = [
  [AidType.FOOD, 'غذاء'], [AidType.WATER, 'مياه'], [AidType.MEDICAL, 'صحة'],
  [AidType.SHELTER, 'إيواء'], [AidType.HYGIENE, 'نظافة'], [AidType.OTHER, 'أخرى'],
] as const;

export default function AddAidScreen() {
  const colors = useColors();
  const { addAid, canManageAids } = useApp();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CreateAidRequest['type']>(AidType.FOOD);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!canManageAids) return setError('ليس لديك صلاحية لإضافة المساعدات (403).');
    setSaving(true); setError('');
    try {
      const result = await addAid({ title: title.trim(), type, quantity: Number(quantity), unit: unit.trim(), location: location.trim(), distributionDate: new Date(date).toISOString() });
      if (result.queued) Alert.alert('بانتظار المزامنة', 'تم حفظ الطلب في قائمة الانتظار، ولم تتم إضافته إلى الخادم بعد.');
      router.back();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ الحملة.'); }
    finally { setSaving(false); }
  };
  const valid = title.trim().length >= 2 && Number(quantity) >= 1 && !!unit.trim() && location.trim().length >= 2 && !Number.isNaN(new Date(date).getTime());
  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
      <Text style={[styles.copy, { color: colors.mutedForeground }]}>ستتم مزامنة الحملة مع خادم الفريق. عند انقطاع الاتصال سيظهر بوضوح أنها بانتظار الإرسال.</Text>
      <Field testID="aid-title" label="اسم الحملة" value={title} onChangeText={setTitle} />
      <Text style={[styles.label, { color: colors.foreground }]}>نوع المساعدة</Text>
      <View style={styles.options}>{types.map(([value, label]) => <Pressable testID={`aid-type-${value}`} key={value} onPress={() => setType(value)} style={[styles.option, { backgroundColor: type === value ? colors.primary : colors.muted }]}><Text style={{ color: type === value ? colors.primaryForeground : colors.foreground, fontFamily: fonts.bold }}>{label}</Text></Pressable>)}</View>
      <Field testID="aid-quantity" label="الكمية" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
      <Field testID="aid-unit" label="الوحدة" value={unit} onChangeText={setUnit} placeholder="سلة، عبوة، قطعة..." />
      <Field testID="aid-location" label="الموقع" value={location} onChangeText={setLocation} />
      <Field testID="aid-date" label="تاريخ التوزيع" value={date} onChangeText={setDate} placeholder="2026-08-28" autoCapitalize="none" />
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <PrimaryButton testID="save-aid" label={saving ? 'جارٍ الحفظ…' : 'حفظ ومزامنة الحملة'} icon="checkmark" disabled={!valid || saving || !canManageAids} onPress={() => void submit()} />
    </KeyboardAwareScrollViewCompat>
  );
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 18 }, copy: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  label: { fontFamily: fonts.bold, textAlign: 'right' }, options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  option: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 }, error: { fontFamily: fonts.bold, textAlign: 'right' },
});