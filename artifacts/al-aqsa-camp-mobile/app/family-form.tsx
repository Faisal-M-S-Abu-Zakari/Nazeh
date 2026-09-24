import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenHeader, Card, fonts, Field, PrimaryButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useGetFamily, useCreateFamily, useUpdateFamily, useListCamps, useListSectors, getListFamiliesQueryKey, getGetFamilyQueryKey, getListCampsQueryKey, getListSectorsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getErrorStatus } from '@/lib/mutationErrors';

function getFamilyErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return 'لا تملك الصلاحية لتنفيذ هذا الإجراء.';
  if (status === 404) return 'لم تعد العائلة متاحة. حدّث البيانات ثم حاول مرة أخرى.';
  if (status === 409) return 'تغيّرت بيانات العائلة. أعد تحميلها ثم حاول مرة أخرى.';
  if (status !== undefined && status >= 500) return 'تعذر الاتصال بالخادم. لم تُحفظ البيانات؛ حاول مرة أخرى.';
  return 'لم تُحفظ البيانات. راجع المدخلات وحاول مرة أخرى.';
}

export default function FamilyFormScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditing = !!id;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { canManagePeople, signedIn, user } = useApp();

  const [headName, setHeadName] = useState('');
  const [phone, setPhone] = useState('');
  const [campId, setCampId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [criticalNotes, setCriticalNotes] = useState('');

  const { data: campsPage, isLoading: campsLoading, isError: campsError, refetch: refetchCamps } = useListCamps({
    query: { enabled: canManagePeople, queryKey: getListCampsQueryKey() }
  });
  const camps = campsPage || [];
  const { data: sectorsPage, isLoading: sectorsLoading, isError: sectorsError, refetch: refetchSectors } = useListSectors({
    query: { enabled: canManagePeople, queryKey: getListSectorsQueryKey() }
  });
  const sectors = (sectorsPage || []).filter(s => s.campId === campId);

  const { data: family, isLoading: isFamilyLoading, isError: familyError, refetch: refetchFamily } = useGetFamily(id as string, {
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
        Alert.alert('تعذر إنشاء العائلة', getFamilyErrorMessage(err));
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
        Alert.alert('تعذر تحديث العائلة', getFamilyErrorMessage(err));
      }
    }
  });

  const handleSave = () => {
    if (campsError || sectorsError || isEditing && (familyError || !family)) {
      Alert.alert('تعذر الحفظ', 'تحقق من تحميل بيانات المخيم والقطاع والعائلة، ثم أعد المحاولة.');
      return;
    }
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
          ...(user?.role === 'DELEGATE' ? {} : { sectorId }),
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

  if (!signedIn || !canManagePeople) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="إضافة عائلة" />
        <View style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>ليس لديك صلاحية لإدارة العائلات.</Text></View>
      </View>
    );
  }

  if (isEditing && (isFamilyLoading || !family && !familyError)) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="تعديل العائلة" />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (isEditing && familyError) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="تعديل العائلة" />
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>تعذر تحميل بيانات العائلة.</Text>
          <Pressable onPress={() => void refetchFamily()} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isEditing && !family) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="تعديل العائلة" />
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>لم يتم العثور على العائلة أو لم تعد متاحة.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title={isEditing ? "تعديل العائلة" : "إضافة عائلة جديدة"} />
      
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
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

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>المخيم *</Text>
          {campsLoading ? <ActivityIndicator color={colors.primary} /> : campsError ? (
            <View style={styles.notice}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>تعذر تحميل المخيمات.</Text>
              <Pressable onPress={() => void refetchCamps()}><Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text></Pressable>
            </View>
          ) : camps.length ? (
            <View style={styles.options}>
              {camps.map(camp => (
                <Pressable
                  key={camp.id}
                  testID={`family-camp-${camp.id}`}
                  disabled={isEditing}
                  accessibilityRole="button"
                  accessibilityState={{ selected: campId === camp.id, disabled: isEditing }}
                  onPress={() => { setCampId(camp.id); setSectorId(''); }}
                  style={[styles.option, { backgroundColor: campId === camp.id ? colors.primary : colors.muted, opacity: isEditing ? 0.7 : 1 }]}
                >
                  <Text style={[styles.optionText, { color: campId === camp.id ? colors.primaryForeground : colors.foreground }]}>{camp.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : <Text style={[styles.helpText, { color: colors.mutedForeground }]}>لا توجد مخيمات متاحة للاختيار.</Text>}

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>المربع / القطاع *</Text>
          {sectorsLoading ? <ActivityIndicator color={colors.primary} /> : sectorsError ? (
            <View style={styles.notice}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>تعذر تحميل القطاعات.</Text>
              <Pressable onPress={() => void refetchSectors()}><Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text></Pressable>
            </View>
          ) : !campId ? (
            <Text style={[styles.helpText, { color: colors.mutedForeground }]}>اختر المخيم أولاً.</Text>
          ) : sectors.length ? (
            <View style={styles.options}>
              {sectors.map(sector => (
                <Pressable
                  key={sector.id}
                  testID={`family-sector-${sector.id}`}
                  disabled={isEditing && user?.role === 'DELEGATE'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sectorId === sector.id, disabled: isEditing && user?.role === 'DELEGATE' }}
                  onPress={() => setSectorId(sector.id)}
                  style={[styles.option, { backgroundColor: sectorId === sector.id ? colors.primary : colors.muted, opacity: isEditing && user?.role === 'DELEGATE' ? 0.7 : 1 }]}
                >
                  <Text style={[styles.optionText, { color: sectorId === sector.id ? colors.primaryForeground : colors.foreground }]}>{sector.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.helpText, { color: colors.mutedForeground }]}>لا توجد قطاعات متاحة في هذا المخيم.</Text>
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
          disabled={!headName || !campId || !sectorId || isSaving || campsLoading || sectorsLoading || campsError || sectorsError}
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
  fieldLabel: { fontFamily: fonts.bold, textAlign: 'right', fontSize: 14 },
  helpText: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'right' },
  notice: { alignItems: 'center', gap: 8 },
  options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  optionText: { fontFamily: fonts.bold, fontSize: 14, textAlign: 'right' },
});