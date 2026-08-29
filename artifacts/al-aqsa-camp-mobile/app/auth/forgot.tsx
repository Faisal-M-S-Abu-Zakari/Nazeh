import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Card, fonts, PrimaryButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function ForgotScreen() {
  const colors = useColors();
  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
      <Text style={[styles.title, { color: colors.foreground }]}>استعادة الوصول</Text>
      <Card>
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>لا يرسل التطبيق رسائل استعادة تلقائياً. تواصل مع مدير النظام ليصدر لك رمز إعادة تعيين لمرة واحدة عبر قناة آمنة.</Text>
      </Card>
      <View style={styles.actions}>
        <PrimaryButton testID="forgot-complete-token" label="لديّ رمز إعادة تعيين" icon="key-outline" onPress={() => router.push('/auth/otp')} />
        <PrimaryButton testID="forgot-back-login" label="العودة لتسجيل الدخول" icon="arrow-back" onPress={() => router.replace('/auth/login')} />
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}
const styles = StyleSheet.create({ content: { padding: 24, gap: 18 }, title: { fontFamily: fonts.extraBold, fontSize: 26, textAlign: 'right', marginTop: 24 }, copy: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, textAlign: 'right' }, actions: { gap: 12 } });