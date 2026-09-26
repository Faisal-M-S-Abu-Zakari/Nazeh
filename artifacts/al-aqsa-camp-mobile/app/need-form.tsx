import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View, StyleSheet, Text, Alert, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenHeader, Card, fonts, Field, PrimaryButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useListFamilies, useCreateNeed, getListNeedsQueryKey, getListFamiliesQueryKey, NeedCategory, NeedPriority } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getMutationErrorMessage } from '@/lib/mutationErrors';

export default function NeedFormScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { canManagePeople } = useApp();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<NeedCategory>('FOOD');
  const [priority, setPriority] = useState<NeedPriority>('MEDIUM');
  const [familyId, setFamilyId] = useState('');
  const requestKey = useRef(`mobile-need-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const { data: familiesPage, isLoading: familiesLoading, isError: familiesError, refetch: refetchFamilies } = useListFamilies({
    query: { enabled: canManagePeople, queryKey: getListFamiliesQueryKey() }
  });
  const families = familiesPage || [];

  const createMutation = useCreateNeed({
    request: { headers: { 'Idempotency-Key': requestKey.current } },
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNeedsQueryKey() });
        router.back();
      },
      onError: (err) => {
        Alert.alert('تعذر إنشاء الاحتياج', getMutationErrorMessage(err));
      }
    }
  });

  const handleSave = () => {
    if (title.trim().length < 2 || !familyId || !families.some(f => f.id === familyId)) {
      Alert.alert('تنبيه', 'يرجى تعبئة الحقول الإلزامية (العنوان، العائلة)');
      return;
    }
    createMutation.mutate({
      data: {
        title: title.trim(),
        description: description || undefined,
        category,
        priority,
        familyId,
      }
    });
  };

  const isSaving = createMutation.isPending;

  if (!canManagePeople) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="إضافة احتياج" />
        <View style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>ليس لديك صلاحية لإضافة احتياج.</Text></View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="إضافة احتياج جديد" />
      
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        bottomOffset={20}
      >
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الأسرة المستفيدة</Text>
          {familiesLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {familiesError ? <Pressable onPress={() => void refetchFamilies()} accessibilityRole="button"><Text style={{ color: colors.destructive, textAlign: 'right' }}>تعذر تحميل الأسر. إعادة المحاولة</Text></Pressable> : null}
          {!familiesLoading && !familiesError && !families.length ? <Text style={{ color: colors.mutedForeground, textAlign: 'right' }}>لا توجد أسر متاحة لإضافة احتياج.</Text> : null}
          {families.map(f => <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ selected: familyId === f.id }} onPress={() => setFamilyId(f.id)} style={[styles.choice, { backgroundColor: familyId === f.id ? colors.primary : colors.muted }]}>
            <Text style={{ color: familyId === f.id ? colors.primaryForeground : colors.foreground, fontFamily: fonts.bold, textAlign: 'right' }}>{f.headName}</Text>
          </Pressable>)}
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>تفاصيل الاحتياج</Text>
          <Field
            testID="need-form-title"
            label="عنوان الاحتياج *" 
            value={title} 
            onChangeText={setTitle} 
            placeholder="مثال: حليب أطفال، خيمة بديلة" 
          />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>التصنيف</Text>
          <View style={styles.options}>{([['FOOD','غذاء'], ['WATER','مياه'], ['MEDICAL','صحة'], ['SHELTER','إيواء'], ['HYGIENE','نظافة'], ['OTHER','أخرى']] as const).map(([value, label]) =>
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={[styles.choice, { backgroundColor: category === value ? colors.primary : colors.muted }]}><Text style={{ color: category === value ? colors.primaryForeground : colors.foreground, fontFamily: fonts.bold }}>{label}</Text></Pressable>)}</View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الأولوية</Text>
          <View style={styles.options}>{([['LOW','منخفضة'], ['MEDIUM','متوسطة'], ['HIGH','عالية'], ['CRITICAL','حرجة']] as const).map(([value, label]) =>
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: priority === value }} onPress={() => setPriority(value)} style={[styles.choice, { backgroundColor: priority === value ? colors.primary : colors.muted }]}><Text style={{ color: priority === value ? colors.primaryForeground : colors.foreground, fontFamily: fonts.bold }}>{label}</Text></Pressable>)}</View>
          <Field
            testID="need-form-description"
            label="الوصف (اختياري)" 
            value={description} 
            onChangeText={setDescription} 
            placeholder="تفاصيل إضافية عن الاحتياج" 
            multiline
            numberOfLines={4}
            style={[styles.textArea, { borderColor: colors.input, color: colors.foreground }]}
          />
        </Card>

        <PrimaryButton 
          testID="need-form-submit"
          label={isSaving ? "جارٍ الحفظ..." : "إضافة الاحتياج"} 
          icon="save-outline" 
          onPress={handleSave} 
          disabled={title.trim().length < 2 || !familyId || isSaving}
        />
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { padding: 20, gap: 16 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, textAlign: 'right', marginBottom: 4 },
  textArea: { 
    height: 100, 
    borderWidth: 1, 
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingTop: 12,
    fontFamily: fonts.regular, 
    fontSize: 16,
    textAlignVertical: 'top'
  },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
});