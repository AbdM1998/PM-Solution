import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { LoadingState } from '@/components/loading-state';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { useNotificationRouter } from '@/hooks/use-notification-router';
import { configureNotificationHandler, registerForPushNotificationsAsync } from '@/lib/notifications';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <AnimatedSplashOverlay />
              <RootNavigator />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  useNotificationRouter();

  useEffect(() => {
    if (status === 'signedIn') {
      void registerForPushNotificationsAsync();
    }
  }, [status]);

  if (status === 'loading') {
    return <LoadingState label="Loading your session…" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="project/[id]" options={{ headerShown: true, title: 'Project' }} />
        <Stack.Screen name="task/[id]" options={{ headerShown: true, title: 'Task' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
