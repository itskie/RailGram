import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, Image, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reelsApi } from '../../../api/client';
import type { ReelComment } from '../types/reel';
import { Heart, X, CornerDownRight, Trash2 } from 'lucide-react-native';
import { useAuthStore } from '../../../store/authStore';

interface ReelCommentsModalProps {
  visible: boolean;
  reelId: string;
  onClose: () => void;
}

// ── Avatar helper ────────────────────────────────────────────────────────────
function Avatar({ uri, name, size }: { uri?: string | null; name: string; size: number }) {
  const radius = size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: radius,
      backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: 'bold' }}>
        {name[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

// ── Reply Item ───────────────────────────────────────────────────────────────
function ReelReplyItem({
  reply,
  reelId,
  currentUsername,
}: {
  reply: ReelComment;
  reelId: string;
  currentUsername?: string;
}) {
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reply.like_count ?? 0);
  const isOwner = currentUsername === reply.author.username;

  const likeMutation = useMutation({
    mutationFn: () => reelsApi.likeComment(reply.id),
    onSuccess: () => {
      setIsLiked(prev => !prev);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => reelsApi.deleteComment(reply.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reel-comments', reelId] });
      queryClient.invalidateQueries({ queryKey: ['reel-replies', reelId, reply.parent_id] });
    },
  });

  return (
    <View style={styles.replyRow}>
      <Avatar uri={reply.author.avatar_url} name={reply.author.username} size={26} />
      <View style={styles.replyContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUser}>{reply.author.username}</Text>
          <Text style={styles.commentTime}>{new Date(reply.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.commentBody}>{reply.body}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.commentActionBtn}
            onPress={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
          >
            <Heart size={12} color={isLiked ? '#E53935' : '#888'} fill={isLiked ? '#E53935' : 'none'} />
            <Text style={[styles.commentActionText, isLiked && styles.liked]}>
              {likeCount > 0 ? likeCount : 'Like'}
            </Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity
              style={styles.commentActionBtn}
              onPress={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={12} color="#E53935" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Comment Item ─────────────────────────────────────────────────────────────
function ReelCommentItem({
  comment,
  reelId,
  onReply,
}: {
  comment: ReelComment;
  reelId: string;
  onReply: (comment: ReelComment) => void;
}) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);
  const [showReplies, setShowReplies] = useState(false);
  const isOwner = currentUser?.username === comment.author.username;

  const { data: replies, isLoading: repliesLoading } = useQuery({
    queryKey: ['reel-replies', reelId, comment.id],
    queryFn: () => reelsApi.getReplies(reelId, comment.id),
    enabled: showReplies && comment.reply_count > 0,
  });

  const likeMutation = useMutation({
    mutationFn: () => reelsApi.likeComment(comment.id),
    onSuccess: () => {
      setIsLiked(prev => !prev);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => reelsApi.deleteComment(comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reel-comments', reelId] });
    },
  });

  const hasReplies = comment.reply_count > 0;

  return (
    <View style={styles.commentContainer}>
      <Avatar uri={comment.author.avatar_url} name={comment.author.username} size={32} />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUser}>{comment.author.username}</Text>
          <Text style={styles.commentTime}>{new Date(comment.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.commentBody}>{comment.body}</Text>

        {/* Actions */}
        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.commentActionBtn}
            onPress={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
          >
            <Heart size={14} color={isLiked ? '#E53935' : '#888'} fill={isLiked ? '#E53935' : 'none'} />
            <Text style={[styles.commentActionText, isLiked && styles.liked]}>
              {likeCount > 0 ? likeCount : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.commentActionBtn} onPress={() => onReply(comment)}>
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity>

          {isOwner && (
            <TouchableOpacity
              style={styles.commentActionBtn}
              onPress={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={14} color="#E53935" />
            </TouchableOpacity>
          )}
        </View>

        {/* Replies toggle */}
        {hasReplies && (
          <TouchableOpacity
            style={styles.repliesToggle}
            onPress={() => setShowReplies(v => !v)}
          >
            <CornerDownRight size={13} color="#888" />
            <Text style={styles.repliesToggleText}>
              {showReplies ? 'Hide replies' : `View ${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Replies list */}
        {showReplies && (
          <View style={styles.repliesContainer}>
            {repliesLoading ? (
              <ActivityIndicator size="small" color="#E53935" style={{ marginTop: 8 }} />
            ) : (
              replies?.map(reply => (
                <ReelReplyItem
                  key={reply.id}
                  reply={reply}
                  reelId={reelId}
                  currentUsername={currentUser?.username}
                />
              ))
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
export function ReelCommentsModal({ visible, reelId, onClose }: ReelCommentsModalProps) {
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery({
    queryKey: ['reel-comments', reelId],
    queryFn: () => reelsApi.getComments(reelId),
    enabled: visible,
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => reelsApi.addComment(reelId, body, replyingTo?.id),
    onSuccess: () => {
      setCommentText('');
      if (replyingTo) {
        queryClient.invalidateQueries({ queryKey: ['reel-replies', reelId, replyingTo.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['reel-comments', reelId] });
      setReplyingTo(null);
    },
  });

  const handleReply = (comment: ReelComment) => {
    if (comment.parent_id) return; // no nested replies
    setReplyingTo({ id: comment.id, username: comment.author.username });
    setCommentText(`@${comment.author.username} `);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Comments</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* List */}
        <FlatList
          data={comments ?? []}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={
            isLoading
              ? <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />
              : <Text style={styles.noComments}>No comments yet</Text>
          }
          renderItem={({ item }) => (
            <ReelCommentItem
              comment={item}
              reelId={reelId}
              onReply={handleReply}
            />
          )}
          style={styles.list}
        />

        {/* Input */}
        <View style={styles.commentInputContainer}>
          {replyingTo && (
            <View style={styles.replyingToBar}>
              <View style={styles.replyingToLeft}>
                <CornerDownRight size={14} color="#666" />
                <Text style={styles.replyingToText}>
                  Replying to <Text style={styles.replyingToHighlight}>@{replyingTo.username}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }}>
                <X size={18} color="#999" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentTextInput}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
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
              {addCommentMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.sendBtnText}>Post</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  closeBtn: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  list: { flex: 1 },
  noComments: { textAlign: 'center', color: '#999', fontSize: 14, paddingVertical: 32 },

  // Root comment
  commentContainer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentUser: { fontSize: 13, fontWeight: '600', color: '#111' },
  commentTime: { fontSize: 11, color: '#999' },
  commentBody: { fontSize: 13, color: '#333', marginTop: 4, lineHeight: 18 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontSize: 12, color: '#888', fontWeight: '500' },
  liked: { color: '#E53935' },

  // Replies
  repliesToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 2 },
  repliesToggleText: { fontSize: 12, color: '#888', fontWeight: '600' },
  repliesContainer: { marginTop: 8, marginLeft: 4, gap: 10 },
  replyRow: { flexDirection: 'row', gap: 8 },
  replyContent: { flex: 1 },

  // Input
  commentInputContainer: { borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  replyingToBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#f9f9f9',
  },
  replyingToLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyingToText: { fontSize: 12, color: '#666' },
  replyingToHighlight: { color: '#E53935', fontWeight: '600' },
  commentInput: { flexDirection: 'row', padding: 12, gap: 8 },
  commentTextInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: '#111', maxHeight: 100,
  },
  sendBtn: { backgroundColor: '#E53935', borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
