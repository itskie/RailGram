import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi, reelsApi } from '../api/client';
import { Heart, X, CornerDownRight, MessageCircle } from 'lucide-react-native';

interface CommentsModalProps {
  visible: boolean;
  type: 'post' | 'reel';
  entityId: string;
  onClose: () => void;
}

// Normalised shape used inside this component
interface AnyComment {
  id: string;
  body: string;
  created_at: string;
  like_count: number;
  reply_count: number;
  parent_id?: string | null;
  author: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ uri, name, size }: { uri?: string | null; name: string; size: number }) {
  const r = size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: r,
      backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: 'bold' }}>
        {name[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

// ── Reply Row ─────────────────────────────────────────────────────────────────
function ReplyItem({
  reply,
  type,
}: {
  reply: AnyComment;
  type: 'post' | 'reel';
}) {
  const [isLiked, setIsLiked] = useState(reply.like_count > 0 ? false : false);
  const [likeCount, setLikeCount] = useState(reply.like_count ?? 0);

  const likeMutation = useMutation({
    mutationFn: () =>
      type === 'post' ? postsApi.likeComment(reply.id) : reelsApi.likeComment(reply.id),
    onSuccess: () => {
      setIsLiked((v) => !v);
      setLikeCount((c) => isLiked ? Math.max(0, c - 1) : c + 1);
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
            style={styles.actionBtn}
            onPress={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
          >
            <Heart size={12} color={isLiked ? '#E53935' : '#999'} fill={isLiked ? '#E53935' : 'none'} />
            {likeCount > 0 && (
              <Text style={[styles.actionText, isLiked && styles.liked]}>{likeCount}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Comment Row ───────────────────────────────────────────────────────────────
function CommentItem({
  comment,
  type,
  entityId,
  onReply,
}: {
  comment: AnyComment;
  type: 'post' | 'reel';
  entityId: string;
  onReply: (c: AnyComment) => void;
}) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);
  const [showReplies, setShowReplies] = useState(false);

  const { data: replies, isLoading: repliesLoading } = useQuery<AnyComment[]>({
    queryKey: ['replies', type, entityId, comment.id],
    queryFn: async () => {
      if (type === 'post') {
        const data = await postsApi.getReplies(entityId, comment.id);
        return (data as any[]).map((r: any) => ({
          ...r,
          author: {
            id: r.author?.id ?? '',
            username: r.author?.username ?? '',
            display_name: r.author?.display_name ?? null,
            avatar_url: r.author?.avatar_url ?? null,
          },
        }));
      } else {
        const data = await reelsApi.getReplies(entityId, comment.id);
        return (data as any[]).map((r: any) => ({
          ...r,
          author: {
            id: r.author?.id ?? '',
            username: r.author?.username ?? '',
            display_name: r.author?.display_name ?? null,
            avatar_url: r.author?.avatar_url ?? null,
          },
        }));
      }
    },
    enabled: showReplies && comment.reply_count > 0,
  });

  const likeMutation = useMutation({
    mutationFn: () =>
      type === 'post' ? postsApi.likeComment(comment.id) : reelsApi.likeComment(comment.id),
    onSuccess: () => {
      setIsLiked((v) => !v);
      setLikeCount((c) => isLiked ? Math.max(0, c - 1) : c + 1);
    },
  });

  return (
    <View style={styles.commentContainer}>
      <Avatar uri={comment.author.avatar_url} name={comment.author.username} size={32} />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUser}>{comment.author.username}</Text>
          <Text style={styles.commentTime}>{new Date(comment.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.commentBody}>{comment.body}</Text>

        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
          >
            <Heart size={14} color={isLiked ? '#E53935' : '#999'} fill={isLiked ? '#E53935' : 'none'} />
            <Text style={[styles.actionText, isLiked && styles.liked]}>
              {likeCount > 0 ? likeCount : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => onReply(comment)}>
            <MessageCircle size={14} color="#999" />
            <Text style={styles.actionText}>Reply</Text>
          </TouchableOpacity>
        </View>

        {comment.reply_count > 0 && (
          <TouchableOpacity
            style={styles.repliesToggle}
            onPress={() => setShowReplies((v) => !v)}
          >
            <CornerDownRight size={13} color="#888" />
            <Text style={styles.repliesToggleText}>
              {showReplies
                ? 'Hide replies'
                : `View ${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}`}
            </Text>
          </TouchableOpacity>
        )}

        {showReplies && (
          <View style={styles.repliesContainer}>
            {repliesLoading ? (
              <ActivityIndicator size="small" color="#E53935" style={{ marginTop: 6 }} />
            ) : (
              replies?.map((r) => (
                <ReplyItem key={r.id} reply={r} type={type} />
              ))
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function CommentsModal({ visible, type, entityId, onClose }: CommentsModalProps) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);

  const { data: comments, isLoading } = useQuery<AnyComment[]>({
    queryKey: ['comments', type, entityId],
    queryFn: async () => {
      if (type === 'post') {
        const data = await postsApi.comments(entityId);
        return (data as any[]).map((c: any) => ({
          ...c,
          author: {
            id: c.author?.id ?? '',
            username: c.author?.username ?? '',
            display_name: c.author?.display_name ?? null,
            avatar_url: c.author?.avatar_url ?? null,
          },
        }));
      } else {
        const data = await reelsApi.getComments(entityId);
        return (data as any[]).map((c: any) => ({
          ...c,
          author: {
            id: c.author?.id ?? '',
            username: c.author?.username ?? '',
            display_name: c.author?.display_name ?? null,
            avatar_url: c.author?.avatar_url ?? null,
          },
        }));
      }
    },
    enabled: visible,
  });

  const addMutation = useMutation<unknown, Error, string>({
    mutationFn: (body: string) =>
      type === 'post'
        ? postsApi.addComment(entityId, body, replyingTo?.id)
        : reelsApi.addComment(entityId, body, replyingTo?.id),
    onSuccess: () => {
      setText('');
      if (replyingTo) {
        qc.invalidateQueries({ queryKey: ['replies', type, entityId, replyingTo.id] });
      }
      qc.invalidateQueries({ queryKey: ['comments', type, entityId] });
      setReplyingTo(null);
    },
  });

  const handleReply = (c: AnyComment) => {
    if (c.parent_id) return;
    setReplyingTo({ id: c.id, username: c.author.username });
    setText(`@${c.author.username} `);
  };

  const handleClose = () => {
    setReplyingTo(null);
    setText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      {/* Dimmed backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

      {/* Sheet */}
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
            <X size={22} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Comments list */}
        <FlatList
          data={comments ?? []}
          keyExtractor={(c) => c.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 8 }}
          ListEmptyComponent={
            isLoading
              ? <ActivityIndicator color="#E53935" style={{ marginTop: 40 }} />
              : <Text style={styles.empty}>No comments yet. Be the first!</Text>
          }
          renderItem={({ item }) => (
            <CommentItem
              comment={item}
              type={type}
              entityId={entityId}
              onReply={handleReply}
            />
          )}
        />

        {/* Input bar */}
        <View style={styles.inputWrap}>
          {replyingTo && (
            <View style={styles.replyBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CornerDownRight size={13} color="#666" />
                <Text style={styles.replyBarText}>
                  Replying to{' '}
                  <Text style={styles.replyBarHandle}>@{replyingTo.username}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setText(''); }} hitSlop={8}>
                <X size={16} color="#999" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}…` : 'Add a comment…'}
              placeholderTextColor="#999"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.postBtn, (!text.trim() || addMutation.isPending) && styles.postBtnDisabled]}
              onPress={() => { if (text.trim()) addMutation.mutate(text.trim()); }}
              disabled={!text.trim() || addMutation.isPending}
            >
              {addMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.postBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '75%',
    minHeight: '50%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#ddd', alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  closeBtn: { position: 'absolute', right: 16 },
  list: { flex: 1 },
  empty: { textAlign: 'center', color: '#999', fontSize: 14, paddingVertical: 40 },

  // Comment
  commentContainer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f7f7f7',
  },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentUser: { fontSize: 13, fontWeight: '600', color: '#111' },
  commentTime: { fontSize: 11, color: '#aaa' },
  commentBody: { fontSize: 13, color: '#333', marginTop: 3, lineHeight: 18 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 5 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, color: '#888' },
  liked: { color: '#E53935' },

  // Replies
  repliesToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  repliesToggleText: { fontSize: 12, color: '#888', fontWeight: '500' },
  repliesContainer: { marginTop: 8, gap: 10 },
  replyRow: { flexDirection: 'row', gap: 8 },
  replyContent: { flex: 1 },

  // Input
  inputWrap: {
    borderTopWidth: 1, borderTopColor: '#eee',
    paddingHorizontal: 12, paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f5f5f5', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6,
  },
  replyBarText: { fontSize: 12, color: '#555' },
  replyBarHandle: { fontWeight: '600', color: '#E53935' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, minHeight: 38, maxHeight: 100,
    backgroundColor: '#f5f5f5', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, color: '#111',
  },
  postBtn: {
    backgroundColor: '#E53935', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  postBtnDisabled: { backgroundColor: '#ccc' },
  postBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
