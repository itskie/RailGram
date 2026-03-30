import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import type { TabParamList } from '../../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type Props = NativeStackScreenProps<RootStackParamList, 'ReelDetail'>;
type TabNav = BottomTabNavigationProp<TabParamList>;

export default function ReelDetailScreen({ route }: Props) {
  const navigation = useNavigation<TabNav>();
  const { reelId } = route.params;

  // Navigate to Reels tab when this screen is mounted
  // The ReelsScreen will handle showing the specific reel
  useEffect(() => {
    // Navigate to Reels tab
    navigation.getParent()?.navigate('Reels');
    // Note: For now, we just navigate to Reels tab
    // Future: Implement specific reel scrolling
  }, [navigation]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#E53935" />
    </View>
  );
}
