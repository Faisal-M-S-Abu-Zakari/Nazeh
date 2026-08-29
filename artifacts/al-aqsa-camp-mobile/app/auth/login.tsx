import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Field, fonts, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const { signIn } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!email.includes('@') || password.length < 8) return setError('تحقق من البريد وكلمة المرور (8 أحرف على الأقل).');
    setSubmitting(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      // Works for both a presented auth modal and a direct /auth/login link.
      router.replace('/');
    } catch (cause) {
      const message = cause instanceof Error && cause.message.includes('401') ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'تعذر تسجيل الدخول. تحقق من الاتصال وحاول مجدداً.';
      setError(message);
    } finally { setSubmitting(false); }
  };
  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
      <View style={[styles.logo, { backgroundColor: colors.primary }]}><Text style={[styles.logoText, { color: colors.gold }]}>الأقصى</Text></View>
      <Text style={[styles.title, { color: colors.foreground }]}>مرحباً بعودتك</Text>
      <Text style={[styles.copy, { color: colors.mutedForeground }]}>استخدم حساب فريق المخيم لمزامنة البيانات والإجراءات مع بقية أجهزة الفريق.</Text>
      <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <PrimaryButton testID="login-submit" label={submitting ? 'جارٍ الدخول…' : 'دخول'} icon="arrow-back" disabled={submitting} onPress={() => void submit()} />
      <Text style={[styles.link, { color: colors.mutedForeground }]}>استعادة كلمة المرور غير متاحة حالياً. تواصل مع مدير النظام.</Text>
    </KeyboardAwareScrollViewCompat>
  );
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 17 }, logo: { width: 78, height: 78, borderRadius: 39, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  logoText: { fontFamily: fonts.extraBold, fontSize: 18 }, title: { fontFamily: fonts.extraBold, fontSize: 27, textAlign: 'center' },
  copy: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, textAlign: 'center' }, error: { fontFamily: fonts.medium, textAlign: 'right' },
  link: { fontFamily: fonts.bold, textAlign: 'center', paddingVertical: 8 },
});