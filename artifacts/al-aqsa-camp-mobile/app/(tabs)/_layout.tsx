import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} /><NativeTabs.Trigger.Label>الرئيسية</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="operations"><NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} /><NativeTabs.Trigger.Label>المساعدات</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="people"><NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} /><NativeTabs.Trigger.Label>السجل</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="alerts"><NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} /><NativeTabs.Trigger.Label>التنبيهات</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="account"><NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} /><NativeTabs.Trigger.Label>الحساب</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const isDark = useColorScheme() === 'dark';
  const icon = (feather: keyof typeof Feather.glyphMap, symbol: string) =>
    ({ focused }: { focused: boolean }) => {
      const color = focused ? colors.primary : colors.mutedForeground;
      return (
        <View style={[styles.iconSurface, focused && { backgroundColor: colors.accent }]}>
          {isIOS ? <SymbolView name={symbol as never} tintColor={color} size={21} /> : <Feather name={feather} size={20} color={color} />}
        </View>
      );
    };

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.mutedForeground,
      tabBarLabelStyle: styles.label,
      tabBarItemStyle: styles.item,
      tabBarStyle: {
        position: 'absolute',
        height: isWeb ? 84 : 64 + insets.bottom,
        paddingTop: 7,
        paddingBottom: isWeb ? 24 : Math.max(insets.bottom, 7),
        backgroundColor: isIOS ? 'transparent' : colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        elevation: 0,
      },
      tabBarBackground: () => isIOS
        ? <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />,
    }}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: icon('home', 'house.fill') }} />
      <Tabs.Screen name="operations" options={{ title: 'المساعدات', tabBarIcon: icon('package', 'shippingbox.fill') }} />
      <Tabs.Screen name="people" options={{ title: 'السجل', tabBarIcon: icon('users', 'person.2.fill') }} />
      <Tabs.Screen name="alerts" options={{ title: 'التنبيهات', tabBarIcon: icon('bell', 'bell.fill') }} />
      <Tabs.Screen name="account" options={{ title: 'الحساب', tabBarIcon: icon('user', 'person.crop.circle.fill') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconSurface: { width: 47, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  item: { paddingVertical: 0 },
  label: { fontFamily: fonts.bold, fontSize: 10, marginTop: 2 },
});

export default function TabLayout() {
  return isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />;
}