import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useCompleteCredential } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Field, fonts, PrimaryButton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function OtpScreen() {
  const colors = useColors();
  const completeCredential = useCompleteCredential();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const validPassword = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  const submit = async () => {
    if (token.trim().length < 32) return setError('أدخل رمز الدعوة أو الاستعادة كاملاً.');
    if (!validPassword) return setError('يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل وتشمل حرفاً كبيراً وصغيراً ورقماً ورمزاً.');
    if (password !== confirmation) return setError('كلمتا المرور غير متطابقتين.');
    setError('');
    try {
      await completeCredential.mutateAsync({ data: { token: token.trim(), password } });
      setToken('');
      setPassword('');
      setConfirmation('');
      router.replace('/auth/login');
    } catch {
      setError('الرمز غير صالح أو منتهي الصلاحية. اطلب رمزاً جديداً وحاول مجدداً.');
    }
  };
  return (
    <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={60}>
      <Text style={[styles.title, { color: colors.foreground }]}>تعيين كلمة المرور</Text>
      <Text style={[styles.copy, { color: colors.mutedForeground }]}>استخدم رمز الدعوة أو الاستعادة مرة واحدة. لن يُحفظ الرمز على هذا الجهاز.</Text>
      <Field testID="credential-token" label="الرمز الآمن" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="ألصق الرمز هنا" />
      <Field testID="credential-password" label="كلمة المرور الجديدة" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>12 حرفاً على الأقل، مع حرف كبير وصغير ورقم ورمز.</Text>
      <Field testID="credential-confirmation" label="تأكيد كلمة المرور" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" />
      {error ? <Text testID="credential-error" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <PrimaryButton testID="credential-submit" label={completeCredential.isPending ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'} icon="checkmark" disabled={completeCredential.isPending || token.trim().length < 32 || !password || !confirmation} onPress={() => void submit()} />
    </KeyboardAwareScrollViewCompat>
  );
}
const styles = StyleSheet.create({ content: { padding: 24, gap: 16 }, title: { fontFamily: fonts.extraBold, fontSize: 26, textAlign: 'right', marginTop: 24 }, copy: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, textAlign: 'right' }, hint: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'right', marginTop: -10 }, error: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'right' } });