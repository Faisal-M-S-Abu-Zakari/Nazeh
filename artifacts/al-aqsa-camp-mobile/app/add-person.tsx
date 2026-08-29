import { Gender, type CreatePersonRequest } from '@workspace/api-client-react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Field, fonts, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function AddPersonScreen() {
  const colors = useColors();
  const { addPerson, canManagePeople } = useApp();
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<CreatePersonRequest['gender']>(Gender.MALE);
  const [birthDate, setBirthDate] = useState('');
  const [tentNumber, setTentNumber] = useState('');
  const [familySize, setFamilySize] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = name.trim().length >= 2 && nationalId.length >= 6 && !Number.isNaN(new Date(birthDate).getTime()) && !!tentNumber.trim() && Number(familySize) >= 1;
  const submit = async () => {
    if (!canManagePeople) return setError('ليس لديك صلاحية لإضافة السجلات (403).');
    setSaving(true); setError('');
    try {
      const result = await addPerson({ nationalId: nationalId.trim(), fullName: name.trim(), gender, birthDate: new Date(birthDate).toISOString(), phone: phone.trim() || undefined, tentNumber: tentNumber.trim(), familySize: Number(familySize) });
      if (result.queued) Alert.alert('بانتظار المزامنة', 'تم حفظ الطلب في قائمة الانتظار، ولم تتم إضافته إلى الخادم بعد.');
      router.back();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ السجل.'); }
    finally { setSaving(false); }
  };
  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
      <Text style={[styles.copy, { color: colors.mutedForeground }]}>يُحفظ السجل في قاعدة بيانات الفريق المشتركة.</Text>
      <Field testID="person-name" label="الاسم الكامل" value={name} onChangeText={setName} />
      <Field testID="person-national-id" label="رقم الهوية" value={nationalId} onChangeText={setNationalId} />
      <Field testID="person-phone" label="رقم الهاتف (اختياري)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text style={[styles.label, { color: colors.foreground }]}>الجنس</Text>
      <View style={styles.options}>
        {([[Gender.MALE, 'ذكر'], [Gender.FEMALE, 'أنثى']] as const).map(([value, label]) => <Pressable testID={`person-gender-${value}`} key={value} onPress={() => setGender(value)} style={[styles.option, { backgroundColor: gender === value ? colors.primary : colors.muted }]}><Text style={[styles.optionText, { color: gender === value ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>)}
      </View>
      <Field testID="person-birth-date" label="تاريخ الميلاد" value={birthDate} onChangeText={setBirthDate} placeholder="1990-01-30" />
      <Field testID="person-tent" label="رقم الخيمة" value={tentNumber} onChangeText={setTentNumber} />
      <Field testID="person-family-size" label="عدد أفراد الأسرة" value={familySize} onChangeText={setFamilySize} keyboardType="number-pad" />
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <PrimaryButton testID="save-person" label={saving ? 'جارٍ الحفظ…' : 'حفظ ومزامنة السجل'} icon="person-add-outline" disabled={!valid || saving || !canManagePeople} onPress={() => void submit()} />
    </KeyboardAwareScrollViewCompat>
  );
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 18 }, copy: { fontFamily: fonts.regular, textAlign: 'right' }, label: { fontFamily: fonts.bold, textAlign: 'right' },
  options: { flexDirection: 'row-reverse', gap: 8 }, option: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  optionText: { fontFamily: fonts.bold }, error: { fontFamily: fonts.bold, textAlign: 'right' },
});