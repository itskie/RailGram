import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TabScreenProps } from '../../navigation/types';
import type { Post } from '../../types';
import { postsApi } from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function PostCard({ post }: { post: Post }) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: () => post.is_liked ? postsApi.unlike(post.id) : postsApi.like(post.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  return (
    <View style={styles.card}>
      {/* Author row */}
      <TouchableOpacity
        style={styles.authorRow}
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
          <Text style={styles.displayName}>{post.author.display_name}</Text>
          {(post.train_no || post.station_code) && (
            <Text style={styles.meta}>
              {post.train_no ? `🚂 ${post.train_no}` : ''}
              {post.train_no && post.station_code ? '  ' : ''}
              {post.station_code ? `📍 ${post.station_code}` : ''}
            </Text>
          )}
        </View>
      </TouchableOpacity>

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
  list: { backgroundColor: '#f5f5f5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  errorText: { color: '#666', fontSize: 16, marginBottom: 12 },
  retryText: { color: '#E53935', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#999', fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: '#fff', marginBottom: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  displayName: { fontSize: 14, fontWeight: '600', color: '#111' },
  meta: { fontSize: 12, color: '#888', marginTop: 2 },
  media: { width: '100%', aspectRatio: 1 },
  actions: { flexDirection: 'row', padding: 10, gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 22 },
  actionCount: { fontSize: 14, color: '#666' },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 12 },
  captionUser: { fontSize: 13, fontWeight: '600', color: '#111' },
  captionText: { fontSize: 13, color: '#333', flexShrink: 1 },
});
