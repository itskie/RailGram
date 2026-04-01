import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import RootNavigator from './src/navigation/RootNavigator';
import { linking } from './src/navigation/linking';
import { useAuthStore } from './src/store/authStore';
import { usePushNotifications, getNavigationFromNotification, type PushNotification } from './src/utils/notifications';

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const navigationRef = useRef<NavigationContainerRef<any>>(null);

function AppContent() {
  const { token } = useAuthStore();

  const handleNotificationInteraction = (notification: PushNotification) => {
    const navigation = getNavigationFromNotification(notification);
    if (navigation && navigationRef.current) {
      navigationRef.current.navigate(navigation.route, navigation.params);
    }
  };

  usePushNotifications(
    token,
    undefined, // onNotificationReceived
    handleNotificationInteraction
  );

  return (
    <NavigationContainer ref={navigationRef} linking={linking} fallback={<StatusBar style="light" />}>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Don't render anything until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
