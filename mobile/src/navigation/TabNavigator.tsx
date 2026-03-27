import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import type { TabParamList } from './types';
import FeedScreen from '../screens/tabs/FeedScreen';
import TrainMapScreen from '../screens/tabs/TrainMapScreen';
import ChatScreen from '../screens/tabs/ChatScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';

const Tab = createBottomTabNavigator<TabParamList>();

function Icon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Feed: '🏠',
    TrainMap: '🗺️',
    Chat: '💬',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <Icon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#E53935',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee' },
        headerStyle: { backgroundColor: '#E53935' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'RailGram' }} />
      <Tab.Screen name="TrainMap" component={TrainMapScreen} options={{ title: 'Live Map' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
