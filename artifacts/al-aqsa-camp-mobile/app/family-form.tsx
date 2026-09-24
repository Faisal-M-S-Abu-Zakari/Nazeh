import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenHeader, Card, fonts, Field, PrimaryButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useGetFamily, useCreateFamily, useUpdateFamily, useListCamps, useListSectors, getListFamiliesQueryKey, getGetFamilyQueryKey, getListCampsQueryKey, getListSectorsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getMutationErrorMessage } from '@/lib/mutationErrors';

export default function FamilyFormScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditing = !!id;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { canManagePeople } = useApp();

  const [headName, setHeadName] = useState('');
  const [phone, setPhone] = useState('');
  const [campId, setCampId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [criticalNotes, setCriticalNotes] = useState('');

  const { data: campsPage } = useListCamps({ query: { queryKey: getListCampsQueryKey() } });
  const camps = campsPage || [];
  const { data: sectorsPage } = useListSectors({ query: { enabled: true, queryKey: getListSectorsQueryKey() } });
  const sectors = (sectorsPage || []).filter(s => s.campId === campId);

  const { data: family, isLoading: isFamilyLoading } = useGetFamily(id as string, {
    query: { enabled: isEditing && canManagePeople, queryKey: getGetFamilyQueryKey(id as string) }
  });

  useEffect(() => {
    if (family && isEditing) {
      setHeadName(family.headName);
      setPhone(family.headPhone || '');
      setCampId(family.campId);
      setSectorId(family.sectorId);
      setCriticalNotes(family.criticalNotes || '');
    }
  }, [family, isEditing]);

  // Set default camp if none selected and camps available
  useEffect(() => {
    if (!isEditing && !campId && camps.length > 0) {
      setCampId(camps[0].id);
    }
  }, [camps, campId, isEditing]);

  const createMutation = useCreateFamily({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() });
        router.back();
      },
      onError: (err) => {
        Alert.alert('تعذر إنشاء العائلة', getMutationErrorMessage(err));
      }
    }
  });

  const updateMutation = useUpdateFamily({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFamilyQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListFamiliesQueryKey() });
        router.back();
      },
      onError: (err) => {
        Alert.alert('تعذر تحديث العائلة', getMutationErrorMessage(err));
      }
    }
  });

  const handleSave = () => {
    if (!headName || !campId || !sectorId) {
      Alert.alert('تنبيه', 'يرجى تعبئة الحقول الإلزامية');
      return;
    }

    if (isEditing && family) {
      updateMutation.mutate({
        familyId: id as string,
        data: {
          headName,
          headPhone: phone || null,
          sectorId,
          criticalNotes: criticalNotes || null,
          expectedVersion: family.version,
        }
      });
    } else {
      createMutation.mutate({
        data: {
          headName,
          headPhone: phone || undefined,
          campId,
          sectorId,
          criticalNotes: criticalNotes || undefined,
          members: [] // Initial empty list
        }
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!canManagePeople) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="إضافة عائلة" />
        <View style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>ليس لديك صلاحية لإدارة العائلات.</Text></View>
      </View>
    );
  }

  if (isEditing && isFamilyLoading) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="تعديل العائلة" />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title={isEditing ? "تعديل العائلة" : "إضافة عائلة جديدة"} />
      
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        bottomOffset={20}
      >
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>البيانات الأساسية</Text>
          
          <Field 
            label="اسم رب الأسرة *" 
            value={headName} 
            onChangeText={setHeadName} 
            placeholder="الاسم الرباعي" 
          />
          
          <Field 
            label="رقم الجوال" 
            value={phone} 
            onChangeText={setPhone} 
            placeholder="05X XXX XXXX"
            keyboardType="phone-pad" 
          />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الموقع في المخيم</Text>
          
          <Field 
            label="المربع / القطاع *" 
            value={sectorId} 
            onChangeText={setSectorId} 
            placeholder="معرف القطاع (اختر من القائمة)" 
          />
          
          {sectors.length > 0 && (
            <View style={styles.hints}>
              <Text style={{ fontFamily: fonts.medium, color: colors.mutedForeground, textAlign: 'right' }}>القطاعات المتاحة:</Text>
              {sectors.map(s => <Text key={s.id} style={{ fontFamily: fonts.regular, color: colors.foreground, textAlign: 'right' }}>{s.name} (معرف: {s.id})</Text>)}
            </View>
          )}

          <Field 
            label="ملاحظات إيواء (اختياري)" 
            value={criticalNotes} 
            onChangeText={setCriticalNotes} 
            placeholder="حالة خاصة، إعاقة، الخ" 
          />
        </Card>

        <PrimaryButton 
          label={isSaving ? "جارٍ الحفظ..." : (isEditing ? "حفظ التغييرات" : "إضافة العائلة")} 
          icon="save-outline" 
          onPress={handleSave} 
          disabled={!headName || !campId || !sectorId || isSaving}
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
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  hints: { backgroundColor: '#00000008', padding: 10, borderRadius: 8 },
});