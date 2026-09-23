import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

type ArchiveConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  loading: boolean;
  testIDPrefix: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ArchiveConfirmModal({
  visible,
  title,
  message,
  loading,
  testIDPrefix,
  onCancel,
  onConfirm,
}: ArchiveConfirmModalProps) {
  const colors = useColors();
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => { if (!loading) onCancel(); }}
    >
      <View style={styles.overlay}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: 0.55 }]} />
        <View
          accessibilityViewIsModal
          testID={`${testIDPrefix}-modal`}
          style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text testID={`${testIDPrefix}-title`} style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text testID={`${testIDPrefix}-message`} style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
          <View testID={`${testIDPrefix}-actions`} style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              testID={`${testIDPrefix}-cancel`}
              disabled={loading}
              onPress={onCancel}
              style={[styles.button, { backgroundColor: colors.muted }]}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>إلغاء</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID={`${testIDPrefix}-confirm`}
              disabled={loading}
              onPress={() => { if (!loading) onConfirm(); }}
              style={[styles.button, { backgroundColor: colors.destructive, opacity: loading ? 0.65 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: colors.destructiveForeground }]}>
                {loading ? 'جارٍ الأرشفة…' : 'تأكيد الأرشفة'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 18, padding: 20 },
  title: { fontFamily: fonts.extraBold, fontSize: 20, textAlign: 'right' },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, textAlign: 'right', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22, minWidth: 0 },
  button: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  buttonText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, textAlign: 'center' },
});