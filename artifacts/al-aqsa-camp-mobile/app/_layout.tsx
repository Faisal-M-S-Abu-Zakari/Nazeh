import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold, useFonts } from '@expo-google-fonts/tajawal';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/context/AppContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'رجوع' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="add-aid" options={{ title: 'إضافة حملة', presentation: 'formSheet', sheetAllowedDetents: [0.7], sheetGrabberVisible: true }} />
      <Stack.Screen name="add-person" options={{ title: 'إضافة سجل', presentation: 'formSheet', sheetAllowedDetents: [0.8], sheetGrabberVisible: true }} />
      <Stack.Screen name="staff-management" options={{ headerShown: false }} />
      <Stack.Screen name="aid/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="person/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="complaint-form" options={{ title: 'إدارة شكوى', presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true }} />
      <Stack.Screen name="task-form" options={{ title: 'إدارة مهمة أمنية', presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AppProvider><RootLayoutNav /></AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
