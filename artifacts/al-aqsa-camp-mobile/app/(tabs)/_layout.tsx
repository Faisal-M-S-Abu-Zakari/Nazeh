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
      <NativeTabs.Trigger
        name="index"
        testID="native-tab-home"
        accessibilityLabel="الرئيسية"
        labelVisibilityMode="labeled"
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md="home"
        />
        <NativeTabs.Trigger.Label>الرئيسية</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="operations"
        testID="native-tab-aids"
        accessibilityLabel="المساعدات"
        labelVisibilityMode="labeled"
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }}
          md="inventory_2"
        />
        <NativeTabs.Trigger.Label>المساعدات</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="people"
        testID="native-tab-people"
        accessibilityLabel="السجل"
        labelVisibilityMode="labeled"
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
          md="groups"
        />
        <NativeTabs.Trigger.Label>السجل</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="alerts"
        testID="native-tab-alerts"
        accessibilityLabel="التنبيهات"
        labelVisibilityMode="labeled"
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bell', selected: 'bell.fill' }}
          md="notifications"
        />
        <NativeTabs.Trigger.Label>التنبيهات</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="account"
        testID="native-tab-account"
        accessibilityLabel="الحساب"
        labelVisibilityMode="labeled"
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="account_circle"
        />
        <NativeTabs.Trigger.Label>الحساب</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const isDark = useColorScheme() === 'dark';
  // The longer Arabic tab title needs more horizontal room in the web fallback.
  const tabItemStyle = (flex: number) => [styles.item, isWeb && { flex }];
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
        // Keep the 34px web safe-area inset and leave room for enlarged labels.
        height: isWeb ? 104 : 64 + insets.bottom,
        paddingTop: 7,
        paddingBottom: isWeb ? 34 : Math.max(insets.bottom, 7),
        backgroundColor: isIOS ? 'transparent' : colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        elevation: 0,
      },
      tabBarBackground: () => isIOS
        ? <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />,
    }}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: icon('home', 'house.fill'), tabBarItemStyle: tabItemStyle(0.9) }} />
      <Tabs.Screen name="operations" options={{ title: 'المساعدات', tabBarIcon: icon('package', 'shippingbox.fill'), tabBarItemStyle: tabItemStyle(1.4) }} />
      <Tabs.Screen name="people" options={{ title: 'السجل', tabBarIcon: icon('users', 'person.2.fill'), tabBarItemStyle: tabItemStyle(0.8) }} />
      <Tabs.Screen name="alerts" options={{ title: 'التنبيهات', tabBarIcon: icon('bell', 'bell.fill'), tabBarItemStyle: tabItemStyle(1) }} />
      <Tabs.Screen name="account" options={{ title: 'الحساب', tabBarIcon: icon('user', 'person.crop.circle.fill'), tabBarItemStyle: tabItemStyle(0.9) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconSurface: { width: 47, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  item: { paddingVertical: 0 },
  label: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 14, marginTop: 2 },
});

export default function TabLayout() {
  const useNativeTabs = Platform.OS === 'android' || isLiquidGlassAvailable();
  return useNativeTabs ? <NativeTabLayout /> : <ClassicTabLayout />;
}
