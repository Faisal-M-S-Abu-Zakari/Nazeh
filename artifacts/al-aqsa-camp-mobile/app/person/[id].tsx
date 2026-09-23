import { Gender, getListPeopleQueryKey, useArchivePerson, useUpdatePerson } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ArchiveConfirmModal } from '@/components/ArchiveConfirmModal';
import { Field, fonts, PrimaryButton, ScreenHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getErrorStatus, getMutationErrorMessage, showMutationError } from '@/lib/mutationErrors';

export default function PersonDetailScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { people, canManagePeople } = useApp();
  const person = people.find((item) => item.id === id);
  const updateMutation = useUpdatePerson();
  const archiveMutation = useArchivePerson();
  const [name, setName] = useState(person?.name ?? '');
  const [nationalId, setNationalId] = useState(person?.nationalId ?? '');
  const [phone, setPhone] = useState(person?.phone === 'لا يوجد هاتف' ? '' : person?.phone ?? '');
  const [gender, setGender] = useState(person?.gender ?? Gender.MALE);
  const [birthDate, setBirthDate] = useState(person?.birthDate.slice(0, 10) ?? '');
  const [tentNumber, setTentNumber] = useState(person?.tentNumber ?? '');
  const [familySize, setFamilySize] = useState(String(person?.familySize ?? ''));
  const [notes, setNotes] = useState(person?.notes ?? '');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!person) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground, fontFamily: fonts.bold }}>لم يتم العثور على السجل</Text></View>;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: getListPeopleQueryKey() });
    await queryClient.refetchQueries({ queryKey: getListPeopleQueryKey() });
  };
  const save = async () => {
    setSaveError(null);
    try {
      await updateMutation.mutateAsync({
        personId: person.id,
        data: {
          fullName: name.trim(), nationalId: nationalId.trim(), phone: phone.trim() || null,
          gender, birthDate: new Date(birthDate).toISOString(), tentNumber: tentNumber.trim(),
          familySize: Number(familySize), notes: notes.trim() || null, expectedVersion: person.version,
        },
      });
      await refresh();
      Alert.alert('تم الحفظ', 'تم تحديث سجل الشخص.');
      router.back();
    } catch (error) {
      setSaveError(getMutationErrorMessage(error));
      await showMutationError(error, refresh);
      if (getErrorStatus(error) === 409) router.back();
    }
  };
  const archive = async () => {
    try {
      await archiveMutation.mutateAsync({ personId: person.id, data: { expectedVersion: person.version } });
      setArchiveOpen(false);
      await refresh();
      router.back();
    } catch (error) {
      setArchiveOpen(false);
      await showMutationError(error, refresh);
    }
  };
  const valid = name.trim().length >= 2 && nationalId.trim().length >= 6 && tentNumber.trim().length > 0 && Number(familySize) >= 1 && !Number.isNaN(new Date(birthDate).getTime());

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title={person.name} subtitle="تعديل سجل النازح" />
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
        <Field testID="edit-person-name" label="الاسم الكامل" value={name} onChangeText={setName} editable={canManagePeople} />
        <Field testID="edit-person-national-id" label="رقم الهوية" value={nationalId} onChangeText={setNationalId} editable={canManagePeople} />
        <Field testID="edit-person-phone" label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={canManagePeople} />
        <Text style={[styles.label, { color: colors.foreground }]}>الجنس</Text>
        <View style={styles.options}>{([[Gender.MALE, 'ذكر'], [Gender.FEMALE, 'أنثى']] as const).map(([value, label]) => <Pressable testID={`edit-person-gender-${value}`} disabled={!canManagePeople} key={value} onPress={() => setGender(value)} style={[styles.option, { backgroundColor: gender === value ? colors.primary : colors.muted }]}><Text style={[styles.optionText, { color: gender === value ? colors.primaryForeground : colors.foreground }]}>{label}</Text></Pressable>)}</View>
        <Field testID="edit-person-birth-date" label="تاريخ الميلاد" value={birthDate} onChangeText={setBirthDate} editable={canManagePeople} />
        <Field testID="edit-person-tent" label="رقم الخيمة" value={tentNumber} onChangeText={setTentNumber} editable={canManagePeople} />
        <Field testID="edit-person-family-size" label="عدد أفراد الأسرة" value={familySize} onChangeText={setFamilySize} keyboardType="number-pad" editable={canManagePeople} />
        <Field testID="edit-person-notes" label="ملاحظات" value={notes} onChangeText={setNotes} multiline editable={canManagePeople} />
        {canManagePeople ? <>
          {saveError ? (
            <View testID="person-save-error" accessibilityRole="alert" style={[styles.saveError, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
              <Text testID="person-save-error-message" style={[styles.saveErrorMessage, { color: colors.foreground }]}>{saveError}</Text>
              <PrimaryButton testID="person-save-error-retry" label="إعادة المحاولة" icon="refresh" disabled={updateMutation.isPending} onPress={() => void save()} />
            </View>
          ) : null}
          <PrimaryButton testID="save-person-edits" label={updateMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'} icon="checkmark" disabled={!valid || updateMutation.isPending || archiveMutation.isPending} onPress={() => void save()} />
          <Pressable testID="archive-person" disabled={archiveMutation.isPending} onPress={() => setArchiveOpen(true)} style={[styles.archive, { borderColor: colors.destructive }]}><Text style={[styles.archiveText, { color: colors.destructive }]}>أرشفة السجل</Text></Pressable>
        </> : <Text style={[styles.readOnly, { color: colors.destructive }]}>هذا السجل متاح للعرض فقط حسب دور حسابك.</Text>}
      </KeyboardAwareScrollViewCompat>
      <ArchiveConfirmModal
        visible={archiveOpen}
        title="تأكيد أرشفة سجل الشخص"
        message={`هل تريد أرشفة سجل «${person.name}»؟ لن يظهر في سجل النازحين النشط.`}
        loading={archiveMutation.isPending}
        testIDPrefix="archive-person"
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => void archive()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 50, gap: 16 }, label: { fontFamily: fonts.bold, textAlign: 'right' },
  options: { flexDirection: 'row-reverse', gap: 8 }, option: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  optionText: { fontFamily: fonts.bold }, archive: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  archiveText: { fontFamily: fonts.bold }, readOnly: { fontFamily: fonts.bold, textAlign: 'center' },
  saveError: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  saveErrorMessage: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'right', flexShrink: 1 },
});