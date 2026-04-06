import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Animated,
  TouchableOpacity, Image, ActivityIndicator, StatusBar, useWindowDimensions,
} from 'react-native';
import Video from 'react-native-video';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Heart, MessageCircle, Bookmark, Share2, Volume2, VolumeX, PlusCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { api } from '../../api/client';
import CommentsSheet from '../../components/CommentsSheet';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

interface Reel {
  id: string;
  title: string | null;
  description: string | null;
  hls_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  train_number: string | null;
  train_name: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  viewer_liked: boolean;
  viewer_saved: boolean;
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
}

function ReelCard({
  item, isActive, muted, onMuteToggle, navigation, screenWidth, screenHeight,
}: {
  item: Reel; isActive: boolean; muted: boolean;
  onMuteToggle: () => void; navigation: any;
  screenWidth: number; screenHeight: number;
}) {
  const [liked, setLiked] = useState(item.viewer_liked);
  const [likeCount, setLikeCount] = useState(item.like_count);
  const [saved, setSaved] = useState(item.viewer_saved);
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(item.comment_count);

  const avatarLetter = (item.user?.username || '?')[0].toUpperCase();

  const handleLike = () => {
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    api.post(`/reels/${item.id}/like`).catch(() => {
      setLiked(l => !l);
      setLikeCount(c => liked ? c + 1 : c - 1);
    });
  };

  const handleSave = () => {
    setSaved(s => !s);
    api.post(`/reels/${item.id}/save`).catch(() => setSaved(s => !s));
  };

  return (
    <View style={[styles.reelContainer, { width: screenWidth, height: screenHeight }]}>
      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setPaused(p => !p)}>
        <Video
          source={{ uri: item.hls_url || item.video_url || '' }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat
          paused={!isActive || paused}
          muted={!isActive || muted}
          ignoreSilentSwitch="ignore"
          playInBackground={false}
          poster={item.thumbnail_url || undefined}
        />
      </TouchableOpacity>

      {/* Gradient overlay bottom */}
      <View style={[styles.bottomGradient, { height: screenHeight * 0.45 }]} />

      {/* Right actions */}
      <View style={styles.rightActions}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarCircle}>
            {item.user?.avatar_url ? (
              <Image source={{ uri: item.user.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.actionItem} onPress={handleLike}>
          <Heart size={30} color={liked ? '#FF3B30' : '#fff'} fill={liked ? '#FF3B30' : 'none'} strokeWidth={1.8} />
          <Text style={styles.actionCount}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => setCommentsOpen(true)}>
          <MessageCircle size={30} color="#fff" strokeWidth={1.8} />
          <Text style={styles.actionCount}>{commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={handleSave}>
          <Bookmark size={28} color={saved ? '#FF6B35' : '#fff'} fill={saved ? '#FF6B35' : 'none'} strokeWidth={1.8} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem}>
          <Share2 size={26} color="#fff" strokeWidth={1.8} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={onMuteToggle}>
          {muted
            ? <VolumeX size={24} color="#fff" strokeWidth={1.8} />
            : <Volume2 size={24} color="#fff" strokeWidth={1.8} />
          }
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <Text style={styles.reelUsername}>@{item.user?.username}</Text>
        {item.title && <Text style={styles.reelTitle}>{item.title}</Text>}
        {item.train_number && (
          <View style={styles.trainPill}>
            <Text style={styles.trainPillText}>🚆 {item.train_number}{item.train_name ? ` · ${item.train_name}` : ''}</Text>
          </View>
        )}
        {item.description ? (
          <Text style={styles.reelDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
      </View>

      <CommentsSheet
        type="reel"
        entityId={item.id}
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentCountChange={setCommentCount}
      />
    </View>
  );
}

export default function ReelsScreen({ navigation }: any) {

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);

  // Hide tab bar when on reels (full screen experience)
  useEffect(() => {
    const parent = navigation?.getParent?.();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(10,10,10,0.92)',
          borderTopColor: '#1a1a1a',
          borderTopWidth: 0.5,
        },
      });
    };
  }, [navigation]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['reels-feed'],
      queryFn: async ({ pageParam = null }) => {
        const params: any = { limit: 5 };
        if (pageParam) params.cursor = pageParam;
        const res = await api.get('/reels/feed', { params });
        return res.data;
      },
      getNextPageParam: (last: any) => last.next_cursor || undefined,
      initialPageParam: null,
    });

  const reels = (data?.pages.flatMap((p) => p.items) ?? []).filter(Boolean);

  const topBarAnim = useRef(new Animated.Value(1)).current; // 1=visible, 0=hidden
  const prevIndex = useRef(0);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index ?? 0;
      setActiveIndex(newIndex);
      if (newIndex !== prevIndex.current) {
        // Hide top bar when scrolling to next reel
        Animated.timing(topBarAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        setTimeout(() => {
          Animated.timing(topBarAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        }, 1500);
        prevIndex.current = newIndex;
      }
    }
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#FF6B35" size="large" /></View>;
  }

  if (reels.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48 }}>🎬</Text>
        <Text style={styles.emptyText}>No reels yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top label */}
      <Animated.View style={[styles.topBar, { top: insets.top + 8, opacity: topBarAnim }]}>
        <Text style={styles.topTitle}>Reels</Text>
        <TouchableOpacity onPress={() => navigation?.navigate('CreateReel')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <PlusCircle size={26} color="#fff" strokeWidth={1.8} />
        </TouchableOpacity>
      </Animated.View>

      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ReelCard
            item={item}
            isActive={isFocused && index === activeIndex}
            muted={muted}
            onMuteToggle={() => setMuted(m => !m)}
            navigation={navigation}
            screenWidth={width}
            screenHeight={height}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#FF6B35" /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  emptyText: { color: '#555', fontSize: 15, marginTop: 12 },

  topBar: {
    position: 'absolute', left: 16, right: 16, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  topTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },

  reelContainer: { backgroundColor: '#000' },

  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'transparent',
  },

  rightActions: {
    position: 'absolute', right: 12, bottom: 100,
    alignItems: 'center', gap: 20,
  },
  avatarWrapper: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: '#FF6B35',
    overflow: 'hidden', marginBottom: 8,
  },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  actionItem: { alignItems: 'center', gap: 4 },
  actionCount: { color: '#fff', fontSize: 13, fontWeight: '600' },

  bottomInfo: {
    position: 'absolute', bottom: 90, left: 14, right: 80,
  },
  reelUsername: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  reelTitle: { color: '#fff', fontWeight: '600', fontSize: 14, marginBottom: 4 },
  trainPill: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,107,53,0.25)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.5)', marginBottom: 6,
  },
  trainPillText: { color: '#FF6B35', fontSize: 12, fontWeight: '600' },
  reelDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18 },
});
