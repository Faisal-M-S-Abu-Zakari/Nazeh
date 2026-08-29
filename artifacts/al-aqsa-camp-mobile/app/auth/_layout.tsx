import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/components/ui';

export default function AuthLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={{
      headerBackButtonDisplayMode: 'minimal',
      headerTintColor: colors.primary,
      headerTitleStyle: { fontFamily: fonts.bold },
      headerTitleAlign: 'center',
      contentStyle: { backgroundColor: colors.surfaceTint },
    }}>
      <Stack.Screen name="login" options={{ title: 'تسجيل الدخول' }} />
      <Stack.Screen name="forgot" options={{ title: 'استعادة كلمة المرور' }} />
      <Stack.Screen name="otp" options={{ title: 'تعيين كلمة المرور' }} />
    </Stack>
  );
}