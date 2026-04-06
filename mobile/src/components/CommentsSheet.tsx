/**
 * CommentsSheet — bottom sheet for BOTH post and reel comments
 * Same logic as web CommentsModal.tsx
 *
 * Usage:
 *   <CommentsSheet type="post" entityId={id} visible={open} onClose={() => setOpen(false)} />
 *   <CommentsSheet type="reel" entityId={id} visible={open} onClose={() => setOpen(false)} />
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, Keyboard, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Send, Heart, ChevronDown, Trash2, CornerDownRight } from 'lucide-react-native';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  body: string;
  created_at: string;
  like_count: number;
  liked: boolean;
  reply_count: number;
  parent_id: string | null;
  author: { username: string; display_name?: string | null; avatar_url?: string | null };
}

// ── Normalize (post comments use `author`, reel comments use `user`) ──────────

function normalize(raw: any, type: 'post' | 'reel'): Comment {
  const a = type === 'post' ? raw.author : (raw.user ?? raw.author);
  return {
    id: String(raw.id),
    body: raw.body,
    created_at: raw.created_at,
    like_count: raw.like_count ?? 0,
    liked: raw.liked ?? false,
    reply_count: raw.reply_count ?? 0,
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    author: {
      username: a?.username ?? '',
      display_name: a?.display_name ?? null,
      avatar_url: a?.avatar_url ?? null,
    },
  };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchComments(type: 'post' | 'reel', entityId: string): Promise<Comment[]> {
  const res = await api.get(type === 'post' ? `/posts/${entityId}/comments` : `/reels/${entityId}/comments`);
  const arr = Array.isArray(res.data) ? res.data : (res.data?.comments ?? res.data?.items ?? []);
  return arr.map((c: any) => normalize(c, type));
}

async function fetchReplies(type: 'post' | 'reel', entityId: string, commentId: string): Promise<Comment[]> {
  const url = type === 'post'
    ? `/posts/${entityId}/comments/${commentId}/replies`
    : `/reels/${entityId}/comments/${commentId}/replies`;
  const res = await api.get(url);
  const arr = Array.isArray(res.data) ? res.data : (res.data?.comments ?? res.data?.items ?? []);
  return arr.map((c: any) => normalize(c, type));
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  type: 'post' | 'reel';
  entityId: string;
  visible: boolean;
  onClose: () => void;
  onCommentCountChange?: (count: number) => void;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommentsSheet({ type, entityId, visible, onClose, onCommentCountChange }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, Comment[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const inputRef = useRef<TextInput>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
    onPanResponderGrant: () => {
      dragStart.current = (translateY as any)._value;
    },
    onPanResponderMove: (_, gs) => {
      const next = dragStart.current + gs.dy;
      if (next >= 0) translateY.setValue(next);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80) {
        Animated.timing(translateY, { toValue: 800, duration: 250, useNativeDriver: true }).start(onClose);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
      }
    },
  })).current;

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || !entityId) return;
    setComments([]);
    setReplyingTo(null);
    setExpandedReplies({});
    setIsLoading(true);
    fetchComments(type, entityId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [visible, entityId, type]);

  useEffect(() => {
    if (replyingTo) setTimeout(() => inputRef.current?.focus(), 100);
  }, [replyingTo]);

  // ── Post comment / reply ──────────────────────────────────────────────────

  const handlePost = useCallback(async () => {
    if (!text.trim() || isPosting || !user) return;
    const parentId = replyingTo?.id;
    setIsPosting(true);

    // Optimistic
    const temp: Comment = {
      id: 'temp-' + Date.now(),
      body: text,
      created_at: new Date().toISOString(),
      like_count: 0, liked: false, reply_count: 0,
      parent_id: parentId ?? null,
      author: { username: user.username, display_name: user.display_name, avatar_url: user.avatar_url },
    };

    if (parentId) {
      setExpandedReplies(prev => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), temp] }));
    } else {
      setComments(prev => { const next = [...prev, temp]; onCommentCountChange?.(next.length); return next; });
    }

    const submittedText = text;
    setText('');
    setReplyingTo(null);
    Keyboard.dismiss();

    try {
      await api.post(
        type === 'post' ? `/posts/${entityId}/comments` : `/reels/${entityId}/comments`,
        { body: submittedText, parent_id: parentId ?? null }
      );
      if (parentId) {
        const replies = await fetchReplies(type, entityId, parentId);
        setExpandedReplies(prev => ({ ...prev, [parentId]: replies }));
        setComments(prev => prev.map(c => c.id === parentId ? { ...c, reply_count: replies.length } : c));
      } else {
        const updated = await fetchComments(type, entityId);
        setComments(updated);
        onCommentCountChange?.(updated.length);
      }
    } catch {
      // Rollback
      if (parentId) {
        setExpandedReplies(prev => ({ ...prev, [parentId]: (prev[parentId] ?? []).filter(c => c.id !== temp.id) }));
      } else {
        setComments(prev => prev.filter(c => c.id !== temp.id));
      }
    } finally {
      setIsPosting(false);
    }
  }, [text, isPosting, user, replyingTo, type, entityId]);

  // ── Like comment ─────────────────────────────────────────────────────────

  const handleLikeComment = useCallback(async (comment: Comment, parentId?: string) => {
    if (!user) return;
    const newLiked = !comment.liked;
    const delta = newLiked ? 1 : -1;

    const applyUpdate = (list: Comment[]) =>
      list.map(c => c.id === comment.id ? { ...c, liked: newLiked, like_count: Math.max(0, c.like_count + delta) } : c);

    if (parentId) {
      setExpandedReplies(prev => ({ ...prev, [parentId]: applyUpdate(prev[parentId] ?? []) }));
    } else {
      setComments(prev => applyUpdate(prev));
    }

    try {
      const res = await api.post(
        type === 'post' ? `/posts/comments/${comment.id}/like` : `/reels/comments/${comment.id}/like`
      );
      const applyServer = (list: Comment[]) =>
        list.map(c => c.id === comment.id ? { ...c, liked: res.data.liked, like_count: res.data.like_count } : c);
      if (parentId) {
        setExpandedReplies(prev => ({ ...prev, [parentId]: applyServer(prev[parentId] ?? []) }));
      } else {
        setComments(prev => applyServer(prev));
      }
    } catch {
      const rollback = (list: Comment[]) =>
        list.map(c => c.id === comment.id ? { ...c, liked: comment.liked, like_count: comment.like_count } : c);
      if (parentId) {
        setExpandedReplies(prev => ({ ...prev, [parentId]: rollback(prev[parentId] ?? []) }));
      } else {
        setComments(prev => rollback(prev));
      }
    }
  }, [user, type]);

  // ── Delete comment ────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (comment: Comment, parentId?: string) => {
    try {
      await api.delete(type === 'post' ? `/posts/comments/${comment.id}` : `/reels/comments/${comment.id}`);
      if (parentId) {
        setExpandedReplies(prev => ({ ...prev, [parentId]: (prev[parentId] ?? []).filter(c => c.id !== comment.id) }));
        setComments(prev => prev.map(c => c.id === parentId ? { ...c, reply_count: Math.max(0, c.reply_count - 1) } : c));
      } else {
        setComments(prev => { const next = prev.filter(c => c.id !== comment.id); onCommentCountChange?.(next.length); return next; });
      }
    } catch {}
  }, [user, type]);

  // ── Load replies ──────────────────────────────────────────────────────────

  const handleLoadReplies = useCallback(async (comment: Comment) => {
    if (expandedReplies[comment.id]) {
      setExpandedReplies(prev => { const next = { ...prev }; delete next[comment.id]; return next; });
      return;
    }
    setLoadingReplies(prev => ({ ...prev, [comment.id]: true }));
    try {
      const replies = await fetchReplies(type, entityId, comment.id);
      setExpandedReplies(prev => ({ ...prev, [comment.id]: replies }));
    } catch {}
    setLoadingReplies(prev => ({ ...prev, [comment.id]: false }));
  }, [expandedReplies, type, entityId]);

  // ── Render comment row ────────────────────────────────────────────────────

  const renderComment = (c: Comment, depth = 0, parentId?: string) => {
    const isExpanded = !!expandedReplies[c.id];
    const isLoadingR = loadingReplies[c.id];
    const al = (c.author.username || '?')[0].toUpperCase();

    return (
      <View key={c.id} style={depth > 0 ? s.replyIndent : undefined}>
        <View style={s.commentRow}>
          <View style={[s.avatar, depth > 0 && s.avatarSm]}>
            {c.author.avatar_url
              ? <Image source={{ uri: c.author.avatar_url }} style={[s.avatarImg, depth > 0 && s.avatarSmImg]} />
              : <Text style={s.avatarLetter}>{al}</Text>}
          </View>
          <View style={s.commentBody}>
            <Text style={s.commentText}>
              <Text style={s.commentUsername}>{c.author.username} </Text>
              {c.body}
            </Text>
            <View style={s.commentMeta}>
              <Text style={s.commentTime}>{timeAgo(c.created_at)}</Text>
              {depth === 0 && user && (
                <TouchableOpacity onPress={() => { setReplyingTo(c); setText(`@${c.author.username} `); }}>
                  <Text style={s.replyBtn}>Reply</Text>
                </TouchableOpacity>
              )}
              {user?.username === c.author.username && (
                <TouchableOpacity onPress={() => handleDelete(c, parentId)}>
                  <Trash2 size={11} color="#555" />
                </TouchableOpacity>
              )}
            </View>
            {/* View replies */}
            {c.reply_count > 0 && depth === 0 && (
              <TouchableOpacity style={s.viewRepliesBtn} onPress={() => handleLoadReplies(c)}>
                {isLoadingR
                  ? <ActivityIndicator size="small" color="#FF6B35" />
                  : <>
                      <ChevronDown size={11} color="#FF6B35" style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
                      <Text style={s.viewRepliesText}>
                        {isExpanded ? 'Hide replies' : `${c.reply_count} ${c.reply_count === 1 ? 'reply' : 'replies'}`}
                      </Text>
                    </>}
              </TouchableOpacity>
            )}
          </View>
          {/* Like */}
          <TouchableOpacity style={s.commentLike} onPress={() => handleLikeComment(c, parentId)}>
            <Heart size={13} color={c.liked ? '#FF3B30' : '#555'} fill={c.liked ? '#FF3B30' : 'none'} strokeWidth={2} />
            {c.like_count > 0 && <Text style={s.likeCount}>{c.like_count}</Text>}
          </TouchableOpacity>
        </View>

        {/* Replies */}
        {isExpanded && (expandedReplies[c.id] ?? []).map(r => renderComment(r, 1, c.id))}
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrapper}>
        <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 8, transform: [{ translateY }] }]}>
          {/* Handle - drag to close */}
          <View style={s.handleArea} {...panResponder.panHandlers}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={22} color="#aaa" />
            </TouchableOpacity>
          </View>

          {/* List */}
          {isLoading ? (
            <View style={s.loadingCenter}><ActivityIndicator color="#FF6B35" /></View>
          ) : comments.length === 0 ? (
            <View style={s.loadingCenter}>
              <Text style={s.emptyText}>No comments yet.</Text>
              <Text style={s.emptySubText}>Be the first to share your thoughts!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              renderItem={({ item }) => renderComment(item)}
              style={s.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Reply indicator */}
          {replyingTo && (
            <View style={s.replyIndicator}>
              <CornerDownRight size={11} color="#888" />
              <Text style={s.replyIndicatorText}>
                Replying to <Text style={{ color: '#FF6B35' }}>@{replyingTo.author.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setText(''); }} style={{ marginLeft: 'auto' }}>
                <X size={13} color="#555" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input */}
          {user ? (
            <View style={s.inputRow}>
              <TextInput
                ref={inputRef}
                style={s.input}
                placeholder={replyingTo ? `Reply to @${replyingTo.author.username}...` : 'Add a comment...'}
                placeholderTextColor="#555"
                value={text}
                onChangeText={setText}
                multiline
                editable={!isPosting}
              />
              <TouchableOpacity onPress={handlePost} disabled={!text.trim() || isPosting}>
                {isPosting
                  ? <ActivityIndicator size="small" color="#FF6B35" />
                  : <Send size={20} color={text.trim() ? '#FF6B35' : '#444'} strokeWidth={2} />}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={s.loginPrompt}>Log in to comment</Text>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrapper: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222',
    height: '75%',
    flexDirection: 'column',
  },
  handleArea: { paddingVertical: 10, alignItems: 'center' },
  handle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222' },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },

  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 14, marginBottom: 4 },
  emptySubText: { color: '#444', fontSize: 12 },

  list: { flex: 1, paddingHorizontal: 16, flexGrow: 1 },

  commentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 10 },
  replyIndent: { marginLeft: 32, borderLeftWidth: 1.5, borderLeftColor: '#222', paddingLeft: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarSm: { width: 24, height: 24, borderRadius: 12 },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  avatarSmImg: { width: 24, height: 24, borderRadius: 12 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  commentBody: { flex: 1 },
  commentUsername: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentText: { color: '#ccc', fontSize: 13, lineHeight: 18 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  commentTime: { color: '#444', fontSize: 11 },
  replyBtn: { color: '#888', fontSize: 11, fontWeight: '600' },
  viewRepliesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  viewRepliesText: { color: '#FF6B35', fontSize: 11, fontWeight: '700' },

  commentLike: { alignItems: 'center', gap: 2, paddingTop: 2 },
  likeCount: { color: '#555', fontSize: 10 },

  replyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0a0a0a', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222' },
  replyIndicatorText: { color: '#888', fontSize: 12, flex: 1 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1e1e1e' },
  input: { flex: 1, color: '#fff', fontSize: 14, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 80 },
  loginPrompt: { color: '#555', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
});
