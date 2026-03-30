import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, Image, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reelsApi } from '../../../api/client';
import type { ReelComment } from '../types/reel';
import { Heart, X, CornerDownRight, Loader2 } from 'lucide-react-native';

interface ReelCommentsModalProps {
  visible: boolean;
  reelId: string;
  onClose: () => void;
}

interface CommentData {
  id: string;
  author: { username: string; display_name?: string; avatar_url?: string };
  body: string;
  like_count: number;
  reply_count: number;
  created_at: string;
}

// ── Comment Item Component ───────────────────────────────────────────────────
function ReelCommentItem({
  comment,
  reelId,
  onReply,
  depth = 0,
}: {
  comment: CommentData;
  reelId: string;
  onReply: (comment: CommentData) => void;
  depth?: number;
}) {
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);

  const likeCommentMutation = useMutation({
    mutationFn: () => reelsApi.likeComment(comment.id),
    onSuccess: () => {
      setIsLiked(!isLiked);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    },
  });

  const isReply = depth > 0;

  return (
    <View style={[styles.commentContainer, isReply && styles.replyContainer]}>
      <Image
        source={{ uri: comment.author.avatar_url || 'https://via.placeholder.com/32' }}
        style={[styles.commentAvatar, isReply && styles.replyAvatar]}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUser}>{comment.author.username}</Text>
          <Text style={styles.commentTime}>
            {new Date(comment.created_at).toLocaleDateString()}
          </Text>
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
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Main ReelCommentsModal ───────────────────────────────────────────────────
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
    mutationFn: (body: string) => reelsApi.addComment(reelId, body),
    onSuccess: () => {
      setCommentText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['reel-comments', reelId] });
    },
  });

  const handleReply = (comment: ReelComment) => {
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

        {/* Comments list */}
        <FlatList
          data={comments ?? []}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />
            ) : (
              <Text style={styles.noComments}>No comments yet</Text>
            )
          }
          renderItem={({ item }: { item: ReelComment }) => (
            <ReelCommentItem
              comment={item}
              reelId={reelId}
              onReply={handleReply}
            />
          )}
          style={styles.list}
        />

        {/* Add comment */}
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
              {addCommentMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>Post</Text>
              )}
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
  
  // Comment styles
  commentContainer: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  replyContainer: { marginLeft: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd' },
  replyAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentUser: { fontSize: 13, fontWeight: '600', color: '#111' },
  commentTime: { fontSize: 11, color: '#999' },
  commentBody: { fontSize: 13, color: '#333', marginTop: 4, lineHeight: 18 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontSize: 12, color: '#888', fontWeight: '500' },
  commentActionTextActive: { color: '#E53935' },
  
  // Comment input
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
