import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

export const fonts = { regular: 'Tajawal_400Regular', medium: 'Tajawal_500Medium', bold: 'Tajawal_700Bold', extraBold: 'Tajawal_800ExtraBold' };

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 8, backgroundColor: colors.primary }]}>
      <View style={styles.headerRow}>
        {action}
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.primaryForeground }]}>{title}</Text>
          {subtitle ? <Text style={[styles.headerSubtitle, { color: colors.accent }]}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.mark, { backgroundColor: colors.gold }]}>
          <Ionicons name="home-outline" size={22} color={colors.primary} />
        </View>
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function PrimaryButton({ label, icon, onPress, disabled, testID }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; testID?: string }) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => [styles.button, { backgroundColor: disabled ? colors.mutedForeground : colors.primary, opacity: pressed ? 0.78 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{label}</Text>
      {icon ? <Ionicons name={icon} size={19} color={colors.primaryForeground} /> : null}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.mutedForeground}
        textAlign="right"
        style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
      />
    </View>
  );
}

export function StatusPill({ text, tone = 'green' }: { text: string; tone?: 'green' | 'gold' | 'red' }) {
  const colors = useColors();
  const backgroundColor = tone === 'green' ? colors.surfaceTint : tone === 'red' ? colors.errorSurface : colors.accent;
  const color = tone === 'red' ? colors.destructive : tone === 'gold' ? colors.warning : colors.primary;
  return <View style={[styles.pill, { backgroundColor }]}><Text style={[styles.pillText, { color }]}>{text}</Text></View>;
}

export function SyncBanner() {
  const colors = useColors();
  const { syncState, syncMessage, retrySync } = useApp();
  const bad = syncState === 'offline' || syncState === 'error';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${syncMessage}. اضغط لإعادة المحاولة`}
      onPress={() => void retrySync()}
      style={[styles.sync, { backgroundColor: bad ? colors.errorSurface : colors.accent }]}
    >
      <Text style={[styles.syncText, { color: bad ? colors.destructive : colors.primary }]}>{syncMessage}</Text>
      <Ionicons name={bad ? 'cloud-offline-outline' : syncState === 'syncing' ? 'sync-outline' : 'cloud-done-outline'} size={17} color={bad ? colors.destructive : colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, alignItems: 'flex-end' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 25, textAlign: 'right' },
  headerSubtitle: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'right', marginTop: 2 },
  mark: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, shadowColor: '#1f3527', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  button: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16 },
  fieldWrap: { gap: 7 },
  label: { fontFamily: fonts.bold, textAlign: 'right', fontSize: 14 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  sync: { minHeight: 38, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  syncText: { fontFamily: fonts.bold, fontSize: 12, textAlign: 'center' },
});