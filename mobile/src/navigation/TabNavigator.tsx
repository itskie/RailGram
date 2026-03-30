import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { TabParamList } from './types';
import FeedScreen from '../screens/tabs/FeedScreen';
import ReelsScreen from '../screens/reels/ReelsScreen';
import TrainMapScreen from '../screens/tabs/TrainMapScreen';
import ChatScreen from '../screens/tabs/ChatScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';
import { PlusSquare, Search, Bell } from 'lucide-react-native';
import { notificationsApi } from '../api/client';

const Tab = createBottomTabNavigator<TabParamList>();

function Icon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Feed: '🏠',
    Reels: '🎬',
    TrainMap: '🗺️',
    Chat: '💬',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>
  );
}

export default function TabNavigator() {
  const navigation = useNavigation<any>();

  const { data: unreadData } = useQuery({
    queryKey: ['notif-unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.unread_count ?? 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <Icon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#E53935',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: { backgroundColor: route.name === 'Reels' ? '#000' : '#fff', borderTopColor: route.name === 'Reels' ? '#111' : '#eee' },
        headerStyle: { backgroundColor: route.name === 'Reels' ? '#000' : '#E53935' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: 'RailGram',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4, marginRight: 8 }}>
              <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ padding: 8 }}>
                <Search color="white" size={22} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ padding: 8 }}>
                <View>
                  <Bell color="white" size={22} />
                  {unreadCount > 0 && (
                    <View style={{
                      position: 'absolute', top: -4, right: -4,
                      backgroundColor: '#FF6B6B', borderRadius: 8,
                      minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1.5, borderColor: '#E53935',
                    }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Tab.Screen 
        name="Reels" 
        component={ReelsScreen} 
        options={{ 
          title: 'Reels',
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('ReelUpload')} style={{ marginRight: 16 }}>
              <PlusSquare color="white" size={24} />
            </TouchableOpacity>
          ),
        }} 
      />
      <Tab.Screen name="TrainMap" component={TrainMapScreen} options={{ title: 'Live Map' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
