import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { formatLastSuccessfulSyncAt } from '@/lib/syncTime';

export const fonts = { regular: 'Tajawal_400Regular', medium: 'Tajawal_500Medium', bold: 'Tajawal_700Bold', extraBold: 'Tajawal_800ExtraBold' };

const logoSource = require('@/assets/images/nazeh-phoenix-logo.png');

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.headerRow}>
        {action}
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
          {subtitle ? <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
        </View>
        <Image source={logoSource} style={{ width: 44, height: 44, resizeMode: 'contain' }} />
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

export function SyncTimestamp({ lastSyncedAt, testID }: { lastSyncedAt?: string | null; testID: string }) {
  const colors = useColors();
  return (
    <Text testID={testID} style={[styles.syncTimestamp, { color: colors.mutedForeground }]}>
      {formatLastSuccessfulSyncAt(lastSyncedAt)}
    </Text>
  );
}
export function SyncBanner({ scope = 'all' }: { scope?: 'all' | 'aids' } = {}) {
  const colors = useColors();
  const { syncState, syncMessage, retrySync, aidsSyncState, aidsSyncMessage, lastAidsSyncAt, retryAids } = useApp();
  const scopedState = scope === 'aids' ? aidsSyncState : syncState;
  const scopedMessage = scope === 'aids' ? aidsSyncMessage : syncMessage;
  const retry = scope === 'aids' ? retryAids : retrySync;
  const bad = scopedState === 'offline' || scopedState === 'error';
  return (
    <View style={styles.syncSection}>
      <Pressable
        testID="retry-sync"
        accessibilityRole="button"
        accessibilityLabel={`${scopedMessage}. اضغط لإعادة المحاولة`}
        onPress={() => void retry()}
        style={[styles.sync, { backgroundColor: bad ? colors.errorSurface : colors.accent }]}
      >
        <Text style={[styles.syncText, { color: bad ? colors.destructive : colors.primary }]}>{scopedMessage}</Text>
        <Ionicons name={bad ? 'cloud-offline-outline' : scopedState === 'syncing' ? 'sync-outline' : 'cloud-done-outline'} size={17} color={bad ? colors.destructive : colors.primary} />
      </Pressable>
      {scope === 'aids' ? (
        <SyncTimestamp testID="aids-last-successful-sync" lastSyncedAt={lastAidsSyncAt} />
      ) : null}
    </View>
  );
}

export function DataFreshnessNotice({ title, message, lastSyncedAt, onRetry, testID }: { title: string; message: string; lastSyncedAt?: string | null; onRetry: () => void; testID: string }) {
  const colors = useColors();
  return (
    <View testID={testID} style={[styles.freshnessNotice, { backgroundColor: colors.errorSurface, borderColor: colors.destructive }]}>
      <View style={styles.freshnessHeading}>
        <Ionicons name="warning-outline" size={18} color={colors.destructive} />
        <Text style={[styles.freshnessTitle, { color: colors.destructive }]}>{title}</Text>
      </View>
      <Text style={[styles.freshnessMessage, { color: colors.foreground }]}>{message}</Text>
      <Text testID={`${testID}-last-sync`} style={[styles.freshnessTimestamp, { color: colors.mutedForeground }]}>{formatLastSuccessfulSyncAt(lastSyncedAt)}</Text>
      <PrimaryButton testID={`${testID}-retry`} label="إعادة المحاولة" icon="refresh" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1 },
  headerRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, alignItems: 'flex-end' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 22, textAlign: 'right' },
  headerSubtitle: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'right', marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  button: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16 },
  fieldWrap: { gap: 7 },
  label: { fontFamily: fonts.bold, textAlign: 'right', fontSize: 14 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  syncSection: { gap: 5 },
  sync: { minHeight: 38, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  syncText: { fontFamily: fonts.bold, fontSize: 12, textAlign: 'center' },
  syncTimestamp: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, textAlign: 'right' },
  freshnessNotice: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 9 },
  freshnessHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  freshnessTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 14, textAlign: 'right' },
  freshnessMessage: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  freshnessTimestamp: { fontFamily: fonts.medium, fontSize: 12, textAlign: 'right' },
});
