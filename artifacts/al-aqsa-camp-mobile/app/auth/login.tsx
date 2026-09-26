import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Field, fonts, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getErrorStatus } from '@/lib/mutationErrors';

const logoSource = require('@/assets/images/nazeh-phoenix-logo.png');

export default function LoginScreen() {
  const colors = useColors();
  const { signIn } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'staff' | 'family'>('staff');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const submit = async () => {
    if (!email.includes('@') || password.length < 8) return setError('تحقق من البريد وكلمة المرور (8 أحرف على الأقل).');
    setSubmitting(true);
    setError('');
    try {
      await signIn(email.trim(), password, accountType);
      router.replace('/');
    } catch (cause) {
      const message = getErrorStatus(cause) === 401 ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'تعذر تسجيل الدخول. تحقق من الاتصال وحاول مجدداً.';
      setError(message);
    } finally { setSubmitting(false); }
  };
  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
      <Image source={logoSource} style={{ width: 88, height: 88, alignSelf: 'center', marginTop: 20, resizeMode: 'contain' }} />
      <Text allowFontScaling style={[styles.title, { color: colors.foreground }]}>مرحباً بعودتك</Text>
      <Text allowFontScaling style={[styles.copy, { color: colors.mutedForeground }]}>اختر نوع الحساب للوصول إلى مساحة فريق المخيم أو ملف أسرتك.</Text>
      <View style={[styles.accountType, { borderColor: colors.border }]}>
        <Pressable testID="login-account-family" accessibilityRole="button" accessibilityLabel="رب الأسرة" accessibilityState={{ selected: accountType === 'family' }} onPress={() => setAccountType('family')} style={[styles.accountOption, { backgroundColor: accountType === 'family' ? colors.primary : 'transparent' }]}><Text allowFontScaling style={[styles.accountOptionText, { color: accountType === 'family' ? colors.background : colors.foreground }]}>رب الأسرة</Text></Pressable>
        <Pressable testID="login-account-staff" accessibilityRole="button" accessibilityLabel="فريق المخيم" accessibilityState={{ selected: accountType === 'staff' }} onPress={() => setAccountType('staff')} style={[styles.accountOption, { backgroundColor: accountType === 'staff' ? colors.primary : 'transparent' }]}><Text allowFontScaling style={[styles.accountOptionText, { color: accountType === 'staff' ? colors.background : colors.foreground }]}>فريق المخيم</Text></Pressable>
      </View>
      <Field testID="login-email" label="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field testID="login-password" label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text testID="login-error" allowFontScaling accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <PrimaryButton testID="login-submit" label={submitting ? 'جارٍ الدخول…' : 'دخول'} icon="arrow-back" disabled={submitting} onPress={() => void submit()} />
      <Pressable testID="forgot-password-link" accessibilityRole="button" accessibilityLabel="نسيت كلمة المرور؟" onPress={() => router.push('/auth/forgot')}><Text allowFontScaling style={[styles.link, { color: colors.primary }]}>نسيت كلمة المرور؟</Text></Pressable>
      <Pressable testID="complete-invite-link" accessibilityRole="button" accessibilityLabel="لديّ رمز دعوة أو استعادة" onPress={() => router.push('/auth/otp')}><Text allowFontScaling style={[styles.link, { color: colors.mutedForeground }]}>لديّ رمز دعوة أو استعادة</Text></Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 17 },
  title: { fontFamily: fonts.extraBold, fontSize: 27, textAlign: 'center' },
  copy: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, textAlign: 'center' }, error: { fontFamily: fonts.medium, textAlign: 'right' },
  link: { fontFamily: fonts.bold, textAlign: 'center', paddingVertical: 8 },
  accountType: { flexDirection: 'row-reverse', borderWidth: 1, borderRadius: 14, padding: 4 }, accountOption: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 6, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, accountOptionText: { maxWidth: '100%', flexShrink: 1, fontFamily: fonts.bold, textAlign: 'center' },
});
