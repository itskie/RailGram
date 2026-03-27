import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { linking } from './src/navigation/linking';
import { useAuthStore } from './src/store/authStore';
import { usePushNotifications, getNavigationFromNotification, type PushNotification } from './src/utils/notifications';

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
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
