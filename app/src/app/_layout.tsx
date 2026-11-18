import React, { useEffect } from 'react';
import { AppState, Platform, ScrollView, Text, View } from 'react-native';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { isRunningInExpoGo } from 'expo';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useFonts, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider } from '@/context/AuthContext';
import { OfflineBanner } from '@/components/Chrome';
import { NotificationBridge } from '@/components/NotificationBridge';
import { AppGate } from '@/components/AppGate';
import { Button } from '@/components/ui';
import { configureNotifications } from '@/services/notifications';
import { retryDelay, shouldRetryQuery } from '@/logic/apiErrors';
import { colors } from '@/theme';
import { prefetchCatalogue } from '@/hooks/queries';
import { restoreQueryCache, startQueryCachePersistence } from '@/lib/queryPersist';

const isExpoGo = isRunningInExpoGo();

SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Foreground display rules + Android channels must be in place before any notification arrives
configureNotifications();
// setOptions is not supported in Expo Go (it only logs a warning there)
if (!isExpoGo) SplashScreen.setOptions({ duration: 400, fade: true });

// React Query: pause requests while offline, refetch when the app returns to the foreground
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry only transient failures (network / timeout / 5xx), max 2 times, with backoff. Never 4xx.
      retry: (count, err) => shouldRetryQuery(count, err),
      retryDelay,
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnReconnect: true,
    },
    // Mutations (payments, progress) are never retried automatically
    mutations: { retry: false },
  },
});

// Start-up: load the copy saved on the phone, then refresh the catalogue in parallel with the session restore
// (fresh entries are skipped). Changes are saved back in the background.
if (Platform.OS !== 'web') {
  restoreQueryCache(queryClient).finally(() => {
    prefetchCatalogue(queryClient).catch(() => undefined);
  });
  startQueryCachePersistence(queryClient);
}

/** Last-resort screen for unexpected render errors (expo-router error boundary). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, gap: 14 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' }}>Something went wrong</Text>
        <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center' }}>
          The screen couldn’t be displayed. Your progress and purchases are safe.
        </Text>
        {__DEV__ && <Text selectable style={{ fontSize: 12, color: colors.danger, textAlign: 'center' }}>{error.message}</Text>}
        <View style={{ gap: 10, marginTop: 8 }}>
          <Button title="Try again" icon="refresh" onPress={retry} />
          <Button title="Go to Home" variant="ghost" onPress={() => router.replace('/')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (Platform.OS !== 'web') focusManager.setFocused(s === 'active');
    });
    // Notification taps (push + learning reminders) are handled by <NotificationBridge />
    return () => sub.remove();
  }, []);

  // Fonts failing to load must not block the app (system font is used instead)
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <NotificationBridge />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="learn/[courseId]" options={{ contentStyle: { backgroundColor: colors.black } }} />
            <Stack.Screen name="checkout/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: false }} />
          </Stack>
          <OfflineBanner />
          <AppGate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
