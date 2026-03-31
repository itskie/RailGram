import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, Pressable, ActionSheetIOS, Alert, Platform, Share, ScrollView,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TabScreenProps } from '../../navigation/types';
import type { UnifiedFeedItem } from '../../types';
import { postsApi, usersApi, reelsApi } from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { ReelCard } from '../../features/reels/components/ReelCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function shortTime(date: Date): string {
  const now = new Date();
  const secs = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(days / 365)}y`;
}

type FeedTab = 'for_you' | 'following';

function UnifiedFeedCard({ item }: { item: UnifiedFeedItem }) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isOwnItem = me?.id === item.author.id;
  const isReel = item.item_type === 'reel';

  const likePostMutation = useMutation({
    mutationFn: () => item.viewer_liked ? postsApi.unlike(item.id) : postsApi.like(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const likeReelMutation = useMutation({
    mutationFn: () => reelsApi.like(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const unlikeReelMutation = useMutation({
    mutationFn: () => reelsApi.unlike(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const saveReelMutation = useMutation({
    mutationFn: () => reelsApi.save(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const unsaveReelMutation = useMutation({
    mutationFn: () => reelsApi.unsave(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const bookmarkPostMutation = useMutation({
    mutationFn: () => item.viewer_bookmarked ? postsApi.unbookmark(item.id) : postsApi.bookmark(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const followMutation = useMutation({
    mutationFn: () => usersApi.follow(item.author.username),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['unified_feed'] });
      const prev = queryClient.getQueryData(['unified_feed']);
      queryClient.setQueriesData({ queryKey: ['unified_feed'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items?.map((i: UnifiedFeedItem) =>
              i.author.id === item.author.id
                ? { ...i, viewer_followed: !i.viewer_followed }
                : i
            ),
          })),
        };
      });
      return { prev };
    },
    onError: (_e: any, _v: any, ctx: any) => { if (ctx?.prev) queryClient.setQueryData(['unified_feed'], ctx.prev); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const deletePostMutation = useMutation({
    mutationFn: () => postsApi.delete(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const deleteReelMutation = useMutation({
    mutationFn: () => reelsApi.delete(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified_feed'] }),
  });

  const showMenu = () => {
    const itemUrl = `https://railgram.in/${isReel ? 'reels' : 'posts'}/${item.id}`;
    if (isOwnItem) {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Copy Link', `Delete ${isReel ? 'Reel' : 'Post'}`], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
          (i) => {
            if (i === 1) Share.share({ url: itemUrl });
            if (i === 2) Alert.alert(`Delete ${isReel ? 'Reel' : 'Post'}`, 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => isReel ? deleteReelMutation.mutate() : deletePostMutation.mutate() },
            ]);
          }
        );
      } else {
        Alert.alert(`${isReel ? 'Reel' : 'Post'} Options`, '', [
          { text: 'Copy Link', onPress: () => Share.share({ message: itemUrl }) },
          { text: `Delete ${isReel ? 'Reel' : 'Post'}`, style: 'destructive', onPress: () => Alert.alert(`Delete ${isReel ? 'Reel' : 'Post'}`, 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => isReel ? deleteReelMutation.mutate() : deletePostMutation.mutate() },
          ]) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } else {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Go to Profile', 'Copy Link', 'Report'], destructiveButtonIndex: 3, cancelButtonIndex: 0 },
          (i) => {
            if (i === 1) navigation.navigate('UserProfile', { username: item.author.username });
            if (i === 2) Share.share({ url: itemUrl });
            if (i === 3) Alert.alert('Reported', 'Thanks for your report. We\'ll review it.');
          }
        );
      } else {
        Alert.alert('Options', '', [
          { text: 'Go to Profile', onPress: () => navigation.navigate('UserProfile', { username: item.author.username }) },
          { text: 'Copy Link', onPress: () => Share.share({ message: itemUrl }) },
          { text: 'Report', style: 'destructive', onPress: () => Alert.alert('Reported', 'Thanks for your report.') },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    }
  };

  const handleLike = () => {
    if (isReel) {
      if (item.viewer_liked) {
        unlikeReelMutation.mutate();
      } else {
        likeReelMutation.mutate();
      }
    } else {
      likePostMutation.mutate();
    }
  };

  const handleSave = () => {
    if (item.viewer_saved) {
      unsaveReelMutation.mutate();
    } else {
      saveReelMutation.mutate();
    }
  };

  const handleBookmark = () => {
    bookmarkPostMutation.mutate();
  };

  return (
    <View style={styles.card}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <TouchableOpacity
          style={styles.authorLeft}
          onPress={() => navigation.navigate('UserProfile', { username: item.author.username })}
        >
          <View style={styles.avatar}>
            {item.author.avatar_url ? (
              <Image source={{ uri: item.author.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{item.author.display_name[0].toUpperCase()}</Text>
            )}
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.displayName}>{item.author.username}</Text>
              <Text style={styles.timestamp}>• {shortTime(new Date(item.created_at))}</Text>
            </View>
            {isReel && item.title && (
              <Text style={styles.reelTitle}>{item.title}</Text>
            )}
            {!isReel && (item.train_no || item.station_code) && (
              <Text style={styles.meta}>
                {item.train_no ? `🚂 ${item.train_no}` : ''}
                {item.train_no && item.station_code ? '  ' : ''}
                {item.station_code ? `📍 ${item.station_code}` : ''}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        {me && !isOwnItem && (
          <Pressable
            onPress={() => followMutation.mutate(undefined as any)}
            style={({ pressed }) => [
              styles.followPill,
              item.viewer_followed ? styles.followPillActive : styles.followPillDefault,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.followPillText, item.viewer_followed && styles.followPillTextActive]}>
              {item.viewer_followed ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        )}
        {me && (
          <Pressable onPress={showMenu} hitSlop={8} style={styles.menuBtn}>
            <Text style={styles.menuDots}>•••</Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {isReel ? (
        <View style={styles.reelContainer}>
          <Text style={styles.reelPlaceholder}>🎬 Reel Video Player</Text>
          <Text style={styles.reelStats}>{item.views || 0} views</Text>
        </View>
      ) : (
        item.media_keys && item.media_keys.length > 0 && (
          <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
            <Image source={{ uri: `https://dzdr0nfpn0f2c.cloudfront.net/${item.media_keys[0]}` }} style={styles.media} resizeMode="cover" />
          </TouchableOpacity>
        )
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleLike}
          disabled={likePostMutation.isPending || likeReelMutation.isPending}
        >
          <Text style={styles.actionIcon}>{(isReel ? item.viewer_liked : item.viewer_liked) ? '❤️' : '🤍'}</Text>
          <Text style={styles.actionCount}>{isReel ? (item.likes_count || 0) : (item.like_count || 0)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{isReel ? (item.comments_count || 0) : (item.comment_count || 0)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { marginLeft: 'auto' }]}
          onPress={isReel ? handleSave : handleBookmark}
        >
          <Text style={styles.actionIcon}>{(isReel ? item.viewer_saved : item.viewer_bookmarked) ? '🔖' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      {/* Caption / Description */}
      {(!isReel && item.caption) || (isReel && item.description) ? (
        <View style={styles.captionRow}>
          <Text style={styles.captionUser}>{item.author.username} </Text>
          <Text style={styles.captionText}>{isReel ? item.description : item.caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FeedScreen(_: TabScreenProps<'Feed'>) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedTab>('for_you');
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['unified_feed', activeTab],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => postsApi.unifiedFeed(activeTab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['unified_feed'] });
    setRefreshing(false);
  }, [queryClient]);

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const renderTab = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'for_you' && styles.tabActive]}
        onPress={() => setActiveTab('for_you')}
      >
        <Text style={[styles.tabText, activeTab === 'for_you' && styles.tabTextActive]}>
          For You
        </Text>
        {activeTab === 'for_you' && <View style={styles.tabIndicator} />}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'following' && styles.tabActive]}
        onPress={() => setActiveTab('following')}
      >
        <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
          Following
        </Text>
        {activeTab === 'following' && <View style={styles.tabIndicator} />}
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load feed</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderTab()}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.item_type}-${item.id}`}
        renderItem={({ item }) => <UnifiedFeedCard item={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color="#f97316" style={{ margin: 16 }} /> : null
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              {activeTab === 'following' 
                ? 'Not following anyone yet. Follow railfans to see their posts!'
                : 'No posts yet. Follow some railfans!'}
            </Text>
          </View>
        }
        contentContainerStyle={items.length === 0 ? { flexGrow: 1 } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#18181b', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabActive: { backgroundColor: '#18181b' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#71717a' },
  tabTextActive: { color: '#fff' },
  tabIndicator: { position: 'absolute', bottom: 0, width: 50, height: 3, backgroundColor: '#f97316', borderRadius: 3 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  errorText: { color: '#a1a1aa', fontSize: 16, marginBottom: 12 },
  retryText: { color: '#f97316', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#71717a', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  card: {
    backgroundColor: '#18181b',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  authorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  followPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, marginLeft: 8 },
  followPillDefault: { backgroundColor: 'rgba(249,115,22,0.1)', borderColor: '#f97316' },
  followPillActive: { backgroundColor: '#27272a', borderColor: '#3f3f46' },
  followPillText: { fontSize: 11, fontWeight: '700', color: '#f97316' },
  followPillTextActive: { color: '#71717a' },
  menuBtn: { marginLeft: 6, padding: 4 },
  menuDots: { fontSize: 16, color: '#71717a', letterSpacing: 1, fontWeight: '700' },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f97316',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  displayName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  timestamp: { fontSize: 12, color: '#71717a' },
  reelTitle: { fontSize: 12, color: '#a8a8a8', marginTop: 2 },
  meta: { fontSize: 12, color: '#71717a', marginTop: 2 },
  media: { width: '100%', aspectRatio: 4 / 5 },
  reelContainer: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  reelPlaceholder: { fontSize: 24, marginBottom: 8 },
  reelStats: { fontSize: 12, color: '#71717a' },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { fontSize: 22 },
  actionCount: { fontSize: 14, fontWeight: '600', color: '#fff' },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 12 },
  captionUser: { fontSize: 13, fontWeight: '600', color: '#fff' },
  captionText: { fontSize: 13, color: '#d4d4d8', flexShrink: 1 },
});
