import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { getTokens } from '../api/client';
import type { RootStackParamList } from './types';

import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import PostDetailScreen from '../screens/stack/PostDetailScreen';
import ReelDetailScreen from '../screens/reels/ReelDetailScreen';
import TrainDetailScreen from '../screens/stack/TrainDetailScreen';
import UserProfileScreen from '../screens/stack/UserProfileScreen';
import StoriesScreen from '../screens/stack/StoriesScreen';
import LeaderboardScreen from '../screens/stack/LeaderboardScreen';
import { ChatRoomScreen } from '../screens/stack/ChatRoomScreen';
import { StoryCreationScreen } from '../screens/stack/StoryCreationScreen';
import ReelUploadScreen from '../screens/reels/ReelUploadScreen';
import NotificationsScreen from '../screens/stack/NotificationsScreen';
import EditProfileScreen from '../screens/stack/EditProfileScreen';
import SearchScreen from '../screens/stack/SearchScreen';
import BlockedUsersScreen from '../screens/stack/BlockedUsersScreen';
import FollowRequestsScreen from '../screens/stack/FollowRequestsScreen';

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
        headerTitleStyle: { fontWeight: '700', fontFamily: 'Inter_700Bold' },
      }}
    >
      {!token ? (
        // Auth screens
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: 'Verify Email' }} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
        </>
      ) : (
        // App screens
        <>
          <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
          <Stack.Screen name="ReelDetail" component={ReelDetailScreen} options={{ title: 'Reel' }} />
          <Stack.Screen name="TrainDetail" component={TrainDetailScreen} options={{ title: 'Train Info' }} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
          <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: 'Message' }} />
          <Stack.Screen name="StoryCreation" component={StoryCreationScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ReelUpload" component={ReelUploadScreen} options={{ title: 'New Reel' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
          <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: 'Blocked Users' }} />
          <Stack.Screen name="FollowRequests" component={FollowRequestsScreen} options={{ title: 'Follow Requests' }} />
          {/* Auth screens accessible even when logged in (e.g. deep links) */}
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: 'Verify Email' }} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
