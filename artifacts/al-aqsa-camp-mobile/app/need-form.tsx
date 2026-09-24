import { router } from 'expo-router';
import { useState } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
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
  const { signedIn } = useApp();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<NeedCategory>('FOOD');
  const [priority, setPriority] = useState<NeedPriority>('MEDIUM');
  const [familyId, setFamilyId] = useState('');

  const { data: familiesPage } = useListFamilies({
    query: { enabled: signedIn, queryKey: getListFamiliesQueryKey() }
  });
  const families = familiesPage || [];

  const createMutation = useCreateNeed({
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
    if (!title || !category || !familyId) {
      Alert.alert('تنبيه', 'يرجى تعبئة الحقول الإلزامية (العنوان، العائلة)');
      return;
    }
    createMutation.mutate({
      data: {
        title,
        description: description || undefined,
        category,
        priority,
        familyId,
      }
    });
  };

  const isSaving = createMutation.isPending;

  if (!signedIn) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="إضافة احتياج" />
        <View style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>يرجى تسجيل الدخول.</Text></View>
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
          <Field 
            label="معرف الأسرة *" 
            value={familyId} 
            onChangeText={setFamilyId} 
            placeholder="أدخل معرف الأسرة (مثال: uuid)" 
          />
          {families.length > 0 && (
             <View style={styles.hints}>
               <Text style={{ fontFamily: fonts.medium, color: colors.mutedForeground, textAlign: 'right' }}>عائلات مقترحة من السجل:</Text>
               {families.slice(0, 3).map(f => <Text key={f.id} style={{ fontFamily: fonts.regular, color: colors.foreground, textAlign: 'right' }}>{f.headName} ({f.id})</Text>)}
             </View>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>تفاصيل الاحتياج</Text>
          <Field 
            label="عنوان الاحتياج *" 
            value={title} 
            onChangeText={setTitle} 
            placeholder="مثال: حليب أطفال، خيمة بديلة" 
          />
          <Field 
            label="التصنيف (FOOD, WATER, MEDICAL, SHELTER, HYGIENE, OTHER)" 
            value={category} 
            onChangeText={(t) => setCategory(t as NeedCategory)} 
            placeholder="FOOD" 
          />
          <Field 
            label="الأهمية (LOW, MEDIUM, HIGH, CRITICAL)" 
            value={priority} 
            onChangeText={(t) => setPriority(t as NeedPriority)} 
            placeholder="MEDIUM" 
          />
          <Field 
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
          label={isSaving ? "جارٍ الحفظ..." : "إضافة الاحتياج"} 
          icon="save-outline" 
          onPress={handleSave} 
          disabled={!title || !familyId || isSaving}
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
  hints: { backgroundColor: '#00000008', padding: 10, borderRadius: 8 },
});