import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { getTokens } from '../api/client';
import type { RootStackParamList } from './types';

import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import PostDetailScreen from '../screens/stack/PostDetailScreen';
import TrainDetailScreen from '../screens/stack/TrainDetailScreen';
import UserProfileScreen from '../screens/stack/UserProfileScreen';
import StoriesScreen from '../screens/stack/StoriesScreen';
import LeaderboardScreen from '../screens/stack/LeaderboardScreen';
import { ChatRoomScreen } from '../screens/stack/ChatRoomScreen';
import { StoryCreationScreen } from '../screens/stack/StoryCreationScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token, loadMe, setToken } = useAuthStore();

  useEffect(() => {
    // On mount, restore token and load user
    getTokens().then(({ access }) => {
      if (access) {
        setToken(access);
        loadMe();
      }
    });
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#E53935' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      {!token ? (
        // Auth screens
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
        </>
      ) : (
        // App screens
        <>
          <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
          <Stack.Screen name="TrainDetail" component={TrainDetailScreen} options={{ title: 'Train Info' }} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
          <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: 'Message' }} />
          <Stack.Screen name="StoryCreation" component={StoryCreationScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}
