import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '../../api/client';
import type { Comment } from '../../types';
import type { RootStackScreenProps } from '../../navigation/types';
import { Heart, MessageCircle } from 'lucide-react-native';

type Props = RootStackScreenProps<'PostDetail'>;

// ── Reply Item Component ─────────────────────────────────────────────────────
function ReplyItem({ reply }: { reply: Comment }) {
  return (
    <View style={styles.replyRow}>
      <View style={styles.replyAvatar}>
        <Text style={styles.replyAvatarText}>
          {reply.author.display_name[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <View style={styles.replyContent}>
        <View style={styles.replyHeader}>
          <Text style={styles.replyUser}>{reply.author.username}</Text>
          <Text style={styles.replyTime}>{reply.created_at}</Text>
        </View>
        <Text style={styles.replyBody}>{reply.body}</Text>
      </View>
    </View>
  );
}

// ── Comment Item Component ───────────────────────────────────────────────────
function CommentItem({
  comment,
  postId,
  onReply,
}: {
  comment: Comment;
  postId: string;
  onReply: (parentComment: Comment) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);

  // Fetch replies if parent comment
  const { data: replies, isLoading: loadingReplies } = useQuery({
    queryKey: ['comment-replies', postId, comment.id],
    queryFn: () => postsApi.getReplies(postId, comment.id),
    enabled: comment.reply_count > 0 && showReplies,
  });

  const likeCommentMutation = useMutation({
    mutationFn: () => postsApi.likeComment(comment.id),
    onSuccess: () => {
      setIsLiked(!isLiked);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    },
  });

  const hasReplies = comment.reply_count > 0 || (replies && replies.length > 0);

  return (
    <View style={styles.commentContainer}>
      <View style={styles.commentRow}>
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarText}>
            {comment.author.display_name[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUser}>{comment.author.username}</Text>
            <Text style={styles.commentTime}>{comment.created_at}</Text>
          </View>
          <Text style={styles.commentBody}>{comment.body}</Text>
          
          {/* Action buttons */}
          <View style={styles.commentActions}>
            <TouchableOpacity
              style={styles.commentActionBtn}
              onPress={() => likeCommentMutation.mutate()}
              disabled={likeCommentMutation.isPending}
            >
              <Heart
                size={14}
                color={isLiked ? '#E53935' : '#888'}
                fill={isLiked ? '#E53935' : 'none'}
              />
              <Text style={[styles.commentActionText, isLiked && styles.commentActionTextActive]}>
                {likeCount > 0 ? likeCount : 'Like'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.commentActionBtn}
              onPress={() => onReply(comment)}
            >
              <MessageCircle size={14} color="#888" />
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>

          </View>

          {/* Show replies count & toggle */}
          {hasReplies && (
            <TouchableOpacity
              style={styles.repliesToggle}
              onPress={() => setShowReplies(!showReplies)}
            >
              <Text style={styles.repliesToggleText}>
                {showReplies ? 'Hide replies' : `View ${comment.reply_count} replies`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Render replies */}
          {showReplies && replies && replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {replies.map((reply) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Main PostDetailScreen ────────────────────────────────────────────────────
export default function PostDetailScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
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
    mutationFn: (body: string) =>
      replyingTo
        ? postsApi.addComment(postId, body) // Backend handles parent_id in body for now
        : postsApi.addComment(postId, body),
    onSuccess: () => {
      setCommentText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => post?.is_liked ? postsApi.unlike(postId) : postsApi.like(postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['post', postId] }),
  });

  const handleReply = (parentComment: Comment) => {
    setReplyingTo(parentComment);
    setCommentText(`@${parentComment.author.username} `);
  };

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
              {post.station_code && (
                <Text style={styles.tag}>
                  📍 {post.station_name ? `${post.station_name} (${post.station_code})` : post.station_code}
                </Text>
              )}
            </View>

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
              <View style={styles.actionBtn}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionCount}>{post.comment_count}</Text>
              </View>
            </View>

            <Text style={styles.commentsHeader}>
              Comments {comments && comments.length > 0 ? `(${comments.length})` : ''}
            </Text>
            {loadingComments && <ActivityIndicator color="#E53935" style={{ marginVertical: 16 }} />}
          </View>
        }
        renderItem={({ item }: { item: Comment }) => (
          <CommentItem
            comment={item}
            postId={postId}
            onReply={handleReply}
          />
        )}
        ListEmptyComponent={
          loadingComments ? null : <Text style={styles.noComments}>No comments yet</Text>
        }
        style={styles.list}
      />

      {/* Add comment */}
      <View style={styles.commentInputContainer}>
        {replyingTo && (
          <View style={styles.replyingToBar}>
            <Text style={styles.replyingToText}>
              Replying to @{replyingTo.author.username}
            </Text>
            <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }}>
              <Text style={styles.cancelReplyText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentInput}>
          <TextInput
            style={styles.commentTextInput}
            placeholder={replyingTo ? `Reply to @${replyingTo.author.username}...` : 'Add a comment...'}
            placeholderTextColor="#999"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!commentText.trim() || addCommentMutation.isPending) && styles.sendBtnDisabled]}
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
  
  // Comment styles
  commentContainer: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentUser: { fontSize: 13, fontWeight: '600', color: '#111' },
  commentTime: { fontSize: 11, color: '#999' },
  commentBody: { fontSize: 13, color: '#333', marginTop: 4, lineHeight: 18 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontSize: 12, color: '#888', fontWeight: '500' },
  commentActionTextActive: { color: '#E53935' },
  repliesToggle: { marginTop: 8, paddingVertical: 4 },
  repliesToggleText: { fontSize: 13, color: '#888', fontWeight: '500' },
  repliesContainer: { marginTop: 8, marginLeft: 8 },
  replyRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  replyAvatar: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center',
  },
  replyAvatarText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  replyContent: { flex: 1 },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyUser: { fontSize: 12, fontWeight: '600', color: '#111' },
  replyTime: { fontSize: 10, color: '#999' },
  replyBody: { fontSize: 12, color: '#333', marginTop: 2, lineHeight: 16 },
  
  // Comment input
  commentInputContainer: { borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  replyingToBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#f9f9f9',
  },
  replyingToText: { fontSize: 12, color: '#666' },
  cancelReplyText: { fontSize: 16, color: '#999', padding: 4 },
  commentInput: { flexDirection: 'row', padding: 12, gap: 8 },
  commentTextInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: '#111', maxHeight: 100,
  },
  sendBtn: { backgroundColor: '#E53935', borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
