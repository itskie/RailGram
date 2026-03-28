import React, { useCallback, useRef } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { ReelCard } from '../../features/reels/components/ReelCard';
import { useReelFeed } from '../../features/reels/hooks/useReelFeed';
import { useReelStore } from '../../store/reelStore';
import type { Reel } from '../../features/reels/types/reel';

const { height } = Dimensions.get('window');

export default function ReelsScreen() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useReelFeed('feed');
  const { setActiveReelId } = useReelStore();
  
  // Pause videos immediately if we navigate away from the Reels tab
  useFocusEffect(
    useCallback(() => {
      // Screen comes into focus: don't auto-play yet, onViewableItemsChanged handles it
      return () => {
        // Screen goes out of focus: pause everything
        setActiveReelId(null);
      };
    }, [setActiveReelId])
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      // The first highly-visible item becomes "active" and autoplay triggers
      const centerItem = viewableItems[0];
      if (centerItem && centerItem.item) {
        setActiveReelId(centerItem.item.id);
      }
    }
  }).current;

  // Render individual Reel
  const renderItem = useCallback(({ item }: { item: Reel }) => {
    return <ReelCard reel={item} />;
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: 'black' }]}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const allReels = data?.pages.flatMap((p) => p.items) || [];

  if (allReels.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: 'black' }]}>
        <Text style={styles.noDataText}>No Reels Yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* High Performance Vertical Paging Engine */}
      <FlashList
        data={allReels}
        renderItem={renderItem}
        estimatedItemSize={height}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
           // Item is considered "viewable" when 50% on screen
           itemVisiblePercentThreshold: 50,
        }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
           isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color="#f97316" />
              </View>
           ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: '#a1a1aa',
    fontSize: 16,
    fontWeight: '600'
  },
  footerLoader: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black'
  }
});
