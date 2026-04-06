import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text } from 'react-native';
import { Home, Train, Map, User, Clapperboard } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Tabs
import FeedScreen from '../screens/tabs/FeedScreen';
import ReelsScreen from '../screens/tabs/ReelsScreen';
import TrainsScreen from '../screens/tabs/TrainsScreen';
import TrainMapScreen from '../screens/tabs/TrainMapScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';

// Stack
import TrainDetailScreen from '../screens/stack/TrainDetailScreen';
import PostDetailScreen from '../screens/stack/PostDetailScreen';
import CreatePostScreen from '../screens/stack/CreatePostScreen';
import CreateReelScreen from '../screens/stack/CreateReelScreen';
import NotificationsScreen from '../screens/stack/NotificationsScreen';
import SearchScreen from '../screens/stack/SearchScreen';
import UserProfileScreen from '../screens/stack/UserProfileScreen';
import EditProfileScreen from '../screens/stack/EditProfileScreen';
import FollowRequestsScreen from '../screens/stack/FollowRequestsScreen';
import BlockedUsersScreen from '../screens/stack/BlockedUsersScreen';
import LeaderboardScreen from '../screens/stack/LeaderboardScreen';
import ChatListScreen from '../screens/stack/ChatListScreen';
import ChatRoomScreen from '../screens/stack/ChatRoomScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MainStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(10,10,10,0.92)',
          borderTopColor: '#1a1a1a',
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={1.8} />, tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Clapperboard color={color} size={size} strokeWidth={1.8} />, tabBarLabel: 'Reels' }}
      />
      <Tab.Screen
        name="Trains"
        component={TrainsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Train color={color} size={size} strokeWidth={1.8} />, tabBarLabel: 'Trains' }}
      />
      <Tab.Screen
        name="TrainMap"
        component={TrainMapScreen}
        options={{ tabBarIcon: ({ color, size }) => <Map color={color} size={size} strokeWidth={1.8} />, tabBarLabel: 'Map' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={1.8} />, tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="MainTabs" component={TabNavigator} />
      <MainStack.Screen name="TrainDetail" component={TrainDetailScreen} />
      <MainStack.Screen name="PostDetail" component={PostDetailScreen} />
      <MainStack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="CreateReel" component={CreateReelScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} />
      <MainStack.Screen name="Search" component={SearchScreen} />
      <MainStack.Screen name="UserProfile" component={UserProfileScreen} />
      <MainStack.Screen name="EditProfile" component={EditProfileScreen} />
      <MainStack.Screen name="FollowRequests" component={FollowRequestsScreen} />
      <MainStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <MainStack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <MainStack.Screen name="ChatList" component={ChatListScreen} />
      <MainStack.Screen name="ChatRoom" component={ChatRoomScreen} />
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, isLoading, loadUser } = useAuthStore();
  useEffect(() => { loadUser(); }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <Text style={{ fontSize: 48 }}>🚂</Text>
        <ActivityIndicator color="#FF6B35" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
