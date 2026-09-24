import { Ionicons } from '@expo/vector-icons';
import {
  ShelterStatus,
  getListCampsQueryKey,
  getListSectorsQueryKey,
  getListSheltersQueryKey,
  type Shelter,
  useArchiveShelter,
  useCreateShelter,
  useListCamps,
  useListSectors,
  useListShelters,
  useUpdateShelter,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Card, Field, fonts, PrimaryButton, ScreenHeader, StatusPill } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getErrorStatus } from '@/lib/mutationErrors';

const shelterStatuses = [
  { value: ShelterStatus.AVAILABLE, label: 'متاحة' },
  { value: ShelterStatus.OCCUPIED, label: 'مشغولة' },
  { value: ShelterStatus.MAINTENANCE, label: 'قيد الصيانة' },
] as const;

function safeErrorMessage(error: unknown) {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return 'لا تملك الصلاحية لتنفيذ هذا الإجراء.';
  if (status === 404) return 'لم تعد وحدة الإيواء متاحة. حدّث القائمة ثم حاول مرة أخرى.';
  if (status === 409) return 'تغيّرت بيانات وحدة الإيواء. حدّث القائمة ثم راجعها قبل المحاولة.';
  if (status === 400) return 'تعذر حفظ التغيير. راجع البيانات وحاول مرة أخرى.';
  if (status !== undefined && status >= 500) return 'تعذر الاتصال بالخادم. لم تُحفظ البيانات؛ حاول مرة أخرى.';
  return 'تعذر حفظ التغيير. تحقق من الاتصال ثم حاول مرة أخرى.';
}

export default function SheltersScreen() {
  const colors = useColors();
  const { user } = useApp();
  const queryClient = useQueryClient();
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canRead = isManager || user?.role === 'DELEGATE' || user?.role === 'SECURITY_OFFICER';

  const campsQuery = useListCamps({
    query: { enabled: canRead, retry: false, queryKey: getListCampsQueryKey() },
  });
  const sectorsQuery = useListSectors({
    query: { enabled: canRead, retry: false, queryKey: getListSectorsQueryKey() },
  });
  const sheltersQuery = useListShelters({
    query: { enabled: canRead, retry: false, queryKey: getListSheltersQueryKey() },
  });

  const createShelter = useCreateShelter();
  const updateShelter = useUpdateShelter();
  const archiveShelter = useArchiveShelter();

  const [campId, setCampId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [editingShelter, setEditingShelter] = useState<Shelter | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState('');
  const [capacity, setCapacity] = useState('');
  const [status, setStatus] = useState<Shelter['status']>(ShelterStatus.AVAILABLE);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const camps = campsQuery.data ?? [];
  const sectors = sectorsQuery.data ?? [];
  const shelters = sheltersQuery.data ?? [];
  const activeCampId = campId || camps[0]?.id || '';
  const campSectors = sectors.filter((sector) => sector.campId === activeCampId);
  const visibleShelters = shelters.filter((shelter) => {
    if (sectorId) return shelter.sectorId === sectorId;
    if (activeCampId) return campSectors.some((sector) => sector.id === shelter.sectorId);
    return true;
  });
  const loading = campsQuery.isLoading || sectorsQuery.isLoading || sheltersQuery.isLoading;
  const dataError = campsQuery.isError || sectorsQuery.isError || sheltersQuery.isError;
  const mutating = createShelter.isPending || updateShelter.isPending || archiveShelter.isPending;

  const refresh = async () => {
    await Promise.all([campsQuery.refetch(), sectorsQuery.refetch(), sheltersQuery.refetch()]);
  };
  const invalidateShelters = async () => {
    await queryClient.invalidateQueries({ queryKey: getListSheltersQueryKey() });
  };
  const resetForm = () => {
    setFormOpen(false);
    setEditingShelter(null);
    setCode('');
    setCapacity('');
    setStatus(ShelterStatus.AVAILABLE);
    setErrorMessage('');
  };
  const beginCreate = () => {
    setEditingShelter(null);
    setCode('');
    setCapacity('');
    setStatus(ShelterStatus.AVAILABLE);
    setErrorMessage('');
    setSuccessMessage('');
    setFormOpen(true);
  };
  const beginEdit = (shelter: Shelter) => {
    const sector = sectors.find((item) => item.id === shelter.sectorId);
    setCampId(sector?.campId ?? '');
    setSectorId(shelter.sectorId);
    setEditingShelter(shelter);
    setCode(shelter.code);
    setCapacity(String(shelter.capacity));
    setStatus(shelter.status);
    setErrorMessage('');
    setSuccessMessage('');
    setFormOpen(true);
  };
  const save = async () => {
    const normalizedCode = code.trim();
    const parsedCapacity = Number(capacity);
    if (!normalizedCode || normalizedCode.length > 80) {
      setErrorMessage('أدخل رمزاً لوحدة الإيواء لا يتجاوز 80 حرفاً.');
      return;
    }
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      setErrorMessage('أدخل سعة صحيحة لا تقل عن شخص واحد.');
      return;
    }
    if (!editingShelter && !sectorId) {
      setErrorMessage('اختر القطاع الذي تتبعه وحدة الإيواء.');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (editingShelter) {
        await updateShelter.mutateAsync({
          shelterId: editingShelter.id,
          data: { code: normalizedCode, capacity: parsedCapacity, status, expectedVersion: editingShelter.version },
        });
        setSuccessMessage('تم تحديث وحدة الإيواء.');
      } else {
        await createShelter.mutateAsync({
          data: { sectorId, code: normalizedCode, capacity: parsedCapacity, status },
        });
        setSuccessMessage('تمت إضافة وحدة الإيواء.');
      }
      resetForm();
      await invalidateShelters();
    } catch (error) {
      setErrorMessage(safeErrorMessage(error));
    }
  };
  const archive = async (shelter: Shelter) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await archiveShelter.mutateAsync({
        shelterId: shelter.id,
        data: { expectedVersion: shelter.version },
      });
      setConfirmArchiveId(null);
      if (editingShelter?.id === shelter.id) resetForm();
      setSuccessMessage('تمت أرشفة وحدة الإيواء.');
      await invalidateShelters();
    } catch (error) {
      setConfirmArchiveId(null);
      setErrorMessage(safeErrorMessage(error));
    }
  };
  const selectedCampName = camps.find((camp) => camp.id === activeCampId)?.name;
  const sectorName = (id: string) => sectors.find((sector) => sector.id === id)?.name ?? 'قطاع غير معروف';
  const statusLabel = (value: Shelter['status']) =>
    shelterStatuses.find((item) => item.value === value)?.label ?? 'غير محددة';

  if (!canRead) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader
          title="وحدات الإيواء"
          subtitle="عرض وإدارة أماكن الإقامة"
          action={
            <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()}>
              <Ionicons name="arrow-forward" size={24} color={colors.primary} />
            </Pressable>
          }
        />
        <View style={styles.center}>
          <Text style={[styles.message, { color: colors.destructive }]}>ليس لديك صلاحية لعرض وحدات الإيواء.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader
        title="وحدات الإيواء"
        subtitle="عرض وإدارة أماكن الإقامة"
        action={
          <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={24} color={colors.primary} />
          </Pressable>
        }
      />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            refreshing={(campsQuery.isFetching || sectorsQuery.isFetching || sheltersQuery.isFetching) && !loading}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }
      >
        {isManager && (
          <PrimaryButton
            testID="shelter-add"
            label="إضافة وحدة إيواء"
            icon="add"
            onPress={formOpen && !editingShelter ? resetForm : beginCreate}
          />
        )}

        {dataError && (
          <Card style={styles.stateCard}>
            <Text style={[styles.message, { color: colors.destructive }]}>تعذر تحميل بيانات المخيم أو القطاعات أو وحدات الإيواء.</Text>
            <Pressable testID="shelters-retry" accessibilityRole="button" onPress={() => void refresh()} style={styles.retryButton}>
              <Text style={[styles.retryText, { color: colors.primary }]}>إعادة المحاولة</Text>
            </Pressable>
          </Card>
        )}

        {!dataError && loading && <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />}

        {!dataError && !loading && (
          <>
            <Card style={styles.selectorCard}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>اختر المخيم</Text>
              {camps.length ? (
                <View style={styles.options}>
                  {camps.map((camp) => (
                    <Pressable
                      key={camp.id}
                      testID={`shelter-camp-${camp.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activeCampId === camp.id }}
                      onPress={() => { setCampId(camp.id); setSectorId(''); }}
                      style={[
                        styles.option,
                        { backgroundColor: activeCampId === camp.id ? colors.primary : colors.muted, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.optionText, { color: activeCampId === camp.id ? colors.primaryForeground : colors.foreground }]}>{camp.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[styles.mutedText, { color: colors.mutedForeground }]}>لا توجد مخيمات متاحة.</Text>
              )}
              <Text style={[styles.sectionTitle, styles.sectorHeading, { color: colors.foreground }]}>اختر القطاع</Text>
              {campSectors.length ? (
                <View style={styles.options}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !sectorId }}
                    onPress={() => setSectorId('')}
                    style={[styles.option, { backgroundColor: !sectorId ? colors.primary : colors.muted, borderColor: colors.border }]}
                  >
                    <Text style={[styles.optionText, { color: !sectorId ? colors.primaryForeground : colors.foreground }]}>كل قطاعات {selectedCampName ?? 'المخيم'}</Text>
                  </Pressable>
                  {campSectors.map((sector) => (
                    <Pressable
                      key={sector.id}
                      testID={`shelter-sector-${sector.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sectorId === sector.id }}
                      onPress={() => setSectorId(sector.id)}
                      style={[styles.option, { backgroundColor: sectorId === sector.id ? colors.primary : colors.muted, borderColor: colors.border }]}
                    >
                      <Text style={[styles.optionText, { color: sectorId === sector.id ? colors.primaryForeground : colors.foreground }]}>{sector.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[styles.mutedText, { color: colors.mutedForeground }]}>لا توجد قطاعات مسجلة لهذا المخيم.</Text>
              )}
            </Card>

            {formOpen && isManager && (
              <Card style={styles.formCard}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {editingShelter ? `تعديل ${editingShelter.code}` : 'وحدة إيواء جديدة'}
                </Text>
                {editingShelter ? (
                  <Text style={[styles.contextText, { color: colors.mutedForeground }]}>
                    {selectedCampName ?? 'المخيم'} · {sectorName(editingShelter.sectorId)}
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.fieldLabel, { color: colors.foreground }]}>القطاع</Text>
                    {campSectors.length ? (
                      <View style={styles.options}>
                        {campSectors.map((sector) => (
                          <Pressable
                            key={sector.id}
                            testID={`shelter-form-sector-${sector.id}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: sectorId === sector.id }}
                            onPress={() => setSectorId(sector.id)}
                            style={[styles.option, { backgroundColor: sectorId === sector.id ? colors.primary : colors.muted, borderColor: colors.border }]}
                          >
                            <Text style={[styles.optionText, { color: sectorId === sector.id ? colors.primaryForeground : colors.foreground }]}>{sector.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <Text style={[styles.mutedText, { color: colors.mutedForeground }]}>أضف قطاعاً للمخيم قبل إنشاء وحدة إيواء.</Text>
                    )}
                  </>
                )}
                <Field
                  label="رمز وحدة الإيواء"
                  value={code}
                  onChangeText={setCode}
                  maxLength={80}
                  autoCapitalize="characters"
                  returnKeyType="next"
                  accessibilityLabel="رمز وحدة الإيواء"
                  testID="shelter-code"
                />
                <Field
                  label="السعة (عدد الأشخاص)"
                  value={capacity}
                  onChangeText={(value) => setCapacity(value.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  accessibilityLabel="السعة بعدد الأشخاص"
                  testID="shelter-capacity"
                />
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>الحالة</Text>
                <View style={styles.options}>
                  {shelterStatuses.map((item) => (
                    <Pressable
                      key={item.value}
                      testID={`shelter-status-${item.value.toLowerCase()}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: status === item.value }}
                      onPress={() => setStatus(item.value)}
                      style={[styles.option, { backgroundColor: status === item.value ? colors.primary : colors.muted, borderColor: colors.border }]}
                    >
                      <Text style={[styles.optionText, { color: status === item.value ? colors.primaryForeground : colors.foreground }]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.formActions}>
                  <PrimaryButton
                    testID="shelter-save"
                    label={editingShelter ? 'حفظ التعديلات' : 'إضافة الوحدة'}
                    icon="checkmark"
                    onPress={() => void save()}
                    disabled={mutating}
                  />
                  <Pressable testID="shelter-cancel" accessibilityRole="button" onPress={resetForm} style={styles.cancelButton}>
                    <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>إلغاء</Text>
                  </Pressable>
                </View>
              </Card>
            )}

            {errorMessage ? (
              <Card style={[styles.stateCard, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
                <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{errorMessage}</Text>
              </Card>
            ) : null}
            {successMessage ? (
              <View accessibilityLiveRegion="polite">
                <Text style={[styles.successText, { color: colors.primary }]}>{successMessage}</Text>
              </View>
            ) : null}
            {visibleShelters.length === 0 ? (
              <Card style={styles.stateCard}>
                <Ionicons name="home-outline" size={28} color={colors.mutedForeground} />
                <Text style={[styles.message, { color: colors.mutedForeground }]}>
                  {sectorId ? 'لا توجد وحدات إيواء مسجلة في هذا القطاع.' : 'لا توجد وحدات إيواء مسجلة لهذا المخيم.'}
                </Text>
                {isManager && !formOpen ? (
                  <Pressable accessibilityRole="button" onPress={beginCreate} style={styles.retryButton}>
                    <Text style={[styles.retryText, { color: colors.primary }]}>إضافة وحدة إيواء</Text>
                  </Pressable>
                ) : null}
              </Card>
            ) : (
              visibleShelters.map((shelter) => {
                const needsArchiveConfirmation = confirmArchiveId === shelter.id;
                return (
                  <Card key={shelter.id} style={styles.shelterCard}>
                    <View style={styles.shelterHeader}>
                      <StatusPill
                        text={statusLabel(shelter.status)}
                        tone={shelter.status === ShelterStatus.MAINTENANCE ? 'gold' : shelter.status === ShelterStatus.OCCUPIED ? 'green' : 'green'}
                      />
                      <View style={styles.shelterTitleWrap}>
                        <Text style={[styles.shelterTitle, { color: colors.foreground }]}>{shelter.code}</Text>
                        <Text style={[styles.contextText, { color: colors.mutedForeground }]}>
                          {sectorName(shelter.sectorId)}{selectedCampName ? ` · ${selectedCampName}` : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.capacityText, { color: colors.mutedForeground }]}>السعة: {shelter.capacity} أشخاص</Text>
                    {isManager ? (
                      <View style={[styles.shelterActions, { borderTopColor: colors.border }]}>
                        <Pressable
                          testID={`shelter-edit-${shelter.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={`تعديل ${shelter.code}`}
                          onPress={() => beginEdit(shelter)}
                          style={styles.iconAction}
                        >
                          <Ionicons name="create-outline" size={22} color={colors.primary} />
                          <Text style={[styles.actionText, { color: colors.primary }]}>تعديل</Text>
                        </Pressable>
                        {needsArchiveConfirmation ? (
                          <View style={styles.confirmActions}>
                            <Text style={[styles.confirmText, { color: colors.destructive }]}>أرشفة {shelter.code}؟</Text>
                            <Pressable
                              testID={`shelter-archive-confirm-${shelter.id}`}
                              accessibilityRole="button"
                              onPress={() => void archive(shelter)}
                              disabled={mutating}
                            >
                              <Text style={[styles.actionText, { color: colors.destructive }]}>تأكيد الأرشفة</Text>
                            </Pressable>
                            <Pressable accessibilityRole="button" onPress={() => setConfirmArchiveId(null)}>
                              <Text style={[styles.actionText, { color: colors.mutedForeground }]}>إلغاء</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            testID={`shelter-archive-${shelter.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={`أرشفة ${shelter.code}`}
                            onPress={() => setConfirmArchiveId(shelter.id)}
                            style={styles.iconAction}
                          >
                            <Ionicons name="archive-outline" size={21} color={colors.destructive} />
                            <Text style={[styles.actionText, { color: colors.destructive }]}>أرشفة</Text>
                          </Pressable>
                        )}
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 118, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loader: { marginTop: 28 },
  stateCard: { alignItems: 'center', gap: 10, paddingVertical: 22 },
  selectorCard: { gap: 12 },
  formCard: { gap: 14 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, textAlign: 'right' },
  sectorHeading: { marginTop: 6 },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 14, textAlign: 'right' },
  options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, minHeight: 40, justifyContent: 'center' },
  optionText: { fontFamily: fonts.medium, fontSize: 14, textAlign: 'center' },
  contextText: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'right', marginTop: 4 },
  mutedText: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'right' },
  message: { fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', lineHeight: 23 },
  retryButton: { padding: 8 },
  retryText: { fontFamily: fonts.bold, fontSize: 15 },
  errorText: { fontFamily: fonts.medium, textAlign: 'right', fontSize: 14 },
  successText: { fontFamily: fonts.bold, textAlign: 'center', fontSize: 14, paddingVertical: 4 },
  formActions: { gap: 8 },
  cancelButton: { alignItems: 'center', paddingVertical: 9 },
  cancelText: { fontFamily: fonts.bold, fontSize: 14 },
  shelterCard: { gap: 12 },
  shelterHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  shelterTitleWrap: { flex: 1, alignItems: 'flex-end' },
  shelterTitle: { fontFamily: fonts.extraBold, fontSize: 20, textAlign: 'right' },
  capacityText: { fontFamily: fonts.medium, fontSize: 14, textAlign: 'right' },
  shelterActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 20, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  iconAction: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, padding: 4 },
  actionText: { fontFamily: fonts.bold, fontSize: 14 },
  confirmActions: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  confirmText: { fontFamily: fonts.medium, fontSize: 13 },
});