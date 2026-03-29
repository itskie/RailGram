import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, Pressable, ActionSheetIOS, Alert, Platform, Share,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TabScreenProps } from '../../navigation/types';
import type { Post } from '../../types';
import { postsApi, usersApi } from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

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

function PostCard({ post }: { post: Post }) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isOwnPost = me?.id === post.author.id;

  const likeMutation = useMutation({
    mutationFn: () => post.is_liked ? postsApi.unlike(post.id) : postsApi.like(post.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  const followMutation = useMutation({
    mutationFn: () => usersApi.follow(post.author.username),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const prev = queryClient.getQueryData(['feed']);
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts?.map((p: Post) =>
              p.author.id === post.author.id
                ? { ...p, viewer_followed: !p.viewer_followed }
                : p
            ),
          })),
        };
      });
      return { prev };
    },
    onError: (_e: any, _v: any, ctx: any) => { if (ctx?.prev) queryClient.setQueryData(['feed'], ctx.prev); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => postsApi.delete(post.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  const showMenu = () => {
    const postUrl = `https://railgram.in/posts/${post.id}`;
    if (isOwnPost) {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Copy Link', 'Delete Post'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
          (i) => {
            if (i === 1) Share.share({ url: postUrl });
            if (i === 2) Alert.alert('Delete Post', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
            ]);
          }
        );
      } else {
        Alert.alert('Post Options', '', [
          { text: 'Copy Link', onPress: () => Share.share({ message: postUrl }) },
          { text: 'Delete Post', style: 'destructive', onPress: () => Alert.alert('Delete Post', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
          ]) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } else {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Go to Profile', 'Copy Link', 'Report'], destructiveButtonIndex: 3, cancelButtonIndex: 0 },
          (i) => {
            if (i === 1) navigation.navigate('UserProfile', { username: post.author.username });
            if (i === 2) Share.share({ url: postUrl });
            if (i === 3) Alert.alert('Reported', 'Thanks for your report. We\'ll review it.');
          }
        );
      } else {
        Alert.alert('Post Options', '', [
          { text: 'Go to Profile', onPress: () => navigation.navigate('UserProfile', { username: post.author.username }) },
          { text: 'Copy Link', onPress: () => Share.share({ message: postUrl }) },
          { text: 'Report', style: 'destructive', onPress: () => Alert.alert('Reported', 'Thanks for your report.') },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    }
  };

  return (
    <View style={styles.card}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <TouchableOpacity
          style={styles.authorLeft}
          onPress={() => navigation.navigate('UserProfile', { username: post.author.username })}
        >
          <View style={styles.avatar}>
            {post.author.avatar_url ? (
              <Image source={{ uri: post.author.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{post.author.display_name[0].toUpperCase()}</Text>
            )}
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.displayName}>{post.author.display_name}</Text>
              <Text style={styles.timestamp}>• {shortTime(new Date(post.created_at))}</Text>
            </View>
            {(post.train_no || post.station_code) && (
              <Text style={styles.meta}>
                {post.train_no ? `🚂 ${post.train_no}` : ''}
                {post.train_no && post.station_code ? '  ' : ''}
                {post.station_code ? `📍 ${post.station_code}` : ''}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        {me && !isOwnPost && (
          <Pressable
            onPress={() => followMutation.mutate()}
            style={({ pressed }) => [
              styles.followPill,
              post.viewer_followed ? styles.followPillActive : styles.followPillDefault,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.followPillText, post.viewer_followed && styles.followPillTextActive]}>
              {post.viewer_followed ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        )}
        {me && (
          <Pressable onPress={showMenu} hitSlop={8} style={styles.menuBtn}>
            <Text style={styles.menuDots}>•••</Text>
          </Pressable>
        )}
      </View>

      {/* Media */}
      {post.media_urls.length > 0 && (
        <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: post.id })}>
          <Image source={{ uri: post.media_urls[0] }} style={styles.media} resizeMode="cover" />
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => likeMutation.mutate()}
          disabled={likeMutation.isPending}
        >
          <Text style={styles.actionIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
          <Text style={styles.actionCount}>{post.like_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.comment_count}</Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {post.caption ? (
        <View style={styles.captionRow}>
          <Text style={styles.captionUser}>{post.author.username} </Text>
          <Text style={styles.captionText}>{post.caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FeedScreen(_: TabScreenProps<'Feed'>) {
  const [refreshing, setRefreshing] = useState(false);
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
    queryKey: ['feed'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => postsApi.feed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['feed'] });
    setRefreshing(false);
  }, [queryClient]);

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#E53935" /></View>;
  }
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load feed</Text>
        <TouchableOpacity onPress={() => refetch()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E53935" />}
      onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#E53935" style={{ margin: 16 }} /> : null}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No posts yet. Follow some railfans!</Text>
        </View>
      }
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: '#09090b' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  errorText: { color: '#a1a1aa', fontSize: 16, marginBottom: 12 },
  retryText: { color: '#f97316', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#71717a', fontSize: 15, textAlign: 'center' },
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
  meta: { fontSize: 12, color: '#71717a', marginTop: 2 },
  media: { width: '100%', aspectRatio: 4 / 5 },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { fontSize: 22 },
  actionCount: { fontSize: 14, fontWeight: '600', color: '#fff' },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 12 },
  captionUser: { fontSize: 13, fontWeight: '600', color: '#fff' },
  captionText: { fontSize: 13, color: '#d4d4d8', flexShrink: 1 },
});
