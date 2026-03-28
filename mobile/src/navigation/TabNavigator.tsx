import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { TabParamList } from './types';
import FeedScreen from '../screens/tabs/FeedScreen';
import ReelsScreen from '../screens/reels/ReelsScreen';
import TrainMapScreen from '../screens/tabs/TrainMapScreen';
import ChatScreen from '../screens/tabs/ChatScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';
import { PlusSquare } from 'lucide-react-native';

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
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'RailGram' }} />
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
