import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '../../api/client';
import type { Comment } from '../../types';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'PostDetail'>;

export default function PostDetailScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const [commentText, setCommentText] = useState('');
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postsApi.get(postId),
  });

  const { data: comments, isLoading: loadingComments } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => postsApi.comments(postId),
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => postsApi.addComment(postId, body),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => post?.is_liked ? postsApi.unlike(postId) : postsApi.like(postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['post', postId] }),
  });

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#E53935" /></View>;
  }
  if (!post) {
    return <View style={styles.centered}><Text style={styles.errorText}>Post not found</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={comments ?? []}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View>
            {/* Media */}
            {post.media_urls.length > 0 && (
              <Image source={{ uri: post.media_urls[0] }} style={styles.media} resizeMode="cover" />
            )}

            {/* Author + actions */}
            <View style={styles.authorRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('UserProfile', { username: post.author.username })}
              >
                <Text style={styles.authorName}>{post.author.display_name}</Text>
                <Text style={styles.authorUsername}>@{post.author.username}</Text>
              </TouchableOpacity>
            </View>

            {/* Caption */}
            {post.caption && <Text style={styles.caption}>{post.caption}</Text>}

            {/* Tags */}
            <View style={styles.tags}>
              {post.train_no && <Text style={styles.tag}>🚂 {post.train_no}</Text>}
              {post.station_code && <Text style={styles.tag}>📍 {post.station_code}</Text>}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => likeMutation.mutate()} disabled={likeMutation.isPending}>
                <Text style={styles.actionIcon}>{post.is_liked ? '❤️' : '🤍'}</Text>
                <Text style={styles.actionCount}>{post.like_count}</Text>
              </TouchableOpacity>
              <View style={styles.actionBtn}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionCount}>{post.comment_count}</Text>
              </View>
            </View>

            <Text style={styles.commentsHeader}>Comments</Text>
            {loadingComments && <ActivityIndicator color="#E53935" style={{ marginVertical: 16 }} />}
          </View>
        }
        renderItem={({ item }: { item: Comment }) => (
          <View style={styles.commentRow}>
            <View style={styles.commentAvatar}>
              <Text style={styles.commentAvatarText}>{item.author.display_name[0].toUpperCase()}</Text>
            </View>
            <View style={styles.commentContent}>
              <Text style={styles.commentUser}>{item.author.username}</Text>
              <Text style={styles.commentBody}>{item.body}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loadingComments ? null : <Text style={styles.noComments}>No comments yet</Text>
        }
        style={styles.list}
      />

      {/* Add comment */}
      <View style={styles.commentInput}>
        <TextInput
          style={styles.commentTextInput}
          placeholder="Add a comment..."
          placeholderTextColor="#999"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
          onPress={() => { if (commentText.trim()) addCommentMutation.mutate(commentText.trim()); }}
          disabled={!commentText.trim() || addCommentMutation.isPending}
        >
          {addCommentMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#666', fontSize: 16 },
  list: { flex: 1 },
  media: { width: '100%', aspectRatio: 1 },
  authorRow: { padding: 14 },
  authorName: { fontSize: 15, fontWeight: '600', color: '#111' },
  authorUsername: { fontSize: 13, color: '#888', marginTop: 2 },
  caption: { paddingHorizontal: 14, paddingBottom: 10, fontSize: 14, color: '#333', lineHeight: 20 },
  tags: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 8 },
  tag: { backgroundColor: '#FFF3F3', color: '#E53935', fontSize: 12, borderRadius: 6, padding: 6 },
  actions: { flexDirection: 'row', padding: 10, gap: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 22 },
  actionCount: { fontSize: 14, color: '#666' },
  commentsHeader: { padding: 14, fontSize: 14, fontWeight: '600', color: '#111' },
  noComments: { textAlign: 'center', color: '#999', fontSize: 14, paddingVertical: 24 },
  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  commentContent: { flex: 1 },
  commentUser: { fontSize: 13, fontWeight: '600', color: '#111' },
  commentBody: { fontSize: 13, color: '#333', marginTop: 2, lineHeight: 18 },
  commentInput: {
    flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  commentTextInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: '#111', maxHeight: 100,
  },
  sendBtn: { backgroundColor: '#E53935', borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
