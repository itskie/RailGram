import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Heart, Send, MessageCircle, CornerDownRight } from 'lucide-react-native';
import { api } from '../../api/client';
import AutoImage from '../../components/AutoImage';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function CommentRow({
  comment, postId, isReel, onReply,
}: {
  comment: any; postId: string; isReel: boolean; onReply: (username: string, commentId: string) => void;
}) {
  const [liked, setLiked] = useState(comment.viewer_liked ?? false);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<any[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const avatarLetter = (comment.author?.username || '?')[0].toUpperCase();
  const replyCount = comment.reply_count ?? 0;

  const handleLike = () => {
    const endpoint = isReel
      ? `/reels/comments/${comment.id}/like`
      : `/posts/comments/${comment.id}/like`;
    if (liked) {
      setLiked(false); setLikeCount((c: number) => c - 1);
      api.delete(endpoint).catch(() => { setLiked(true); setLikeCount((c: number) => c + 1); });
    } else {
      setLiked(true); setLikeCount((c: number) => c + 1);
      api.post(endpoint).catch(() => { setLiked(false); setLikeCount((c: number) => c - 1); });
    }
  };

  const loadReplies = async () => {
    if (showReplies) { setShowReplies(false); return; }
    setLoadingReplies(true);
    try {
      const endpoint = isReel
        ? `/reels/${postId}/comments/${comment.id}/replies`
        : `/posts/${postId}/comments/${comment.id}/replies`;
      const res = await api.get(endpoint, { params: { limit: 20 } });
      const data = res.data;
      setReplies(Array.isArray(data) ? data : (data.comments ?? data.items ?? []));
      setShowReplies(true);
    } catch {}
    setLoadingReplies(false);
  };

  return (
    <View style={styles.commentBlock}>
      <View style={styles.commentRow}>
        <View style={styles.commentAvatar}>
          {comment.author?.avatar_url
            ? <Image source={{ uri: comment.author.avatar_url }} style={styles.commentAvatarImg} />
            : <Text style={styles.commentAvatarLetter}>{avatarLetter}</Text>}
        </View>
        <View style={styles.commentContent}>
          <Text style={styles.commentText}>
            <Text style={styles.commentUsername}>{comment.author?.username} </Text>
            {comment.body}
          </Text>
          <View style={styles.commentMeta}>
            <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
            <TouchableOpacity onPress={() => onReply(comment.author?.username, comment.id)}>
              <Text style={styles.replyBtn}>Reply</Text>
            </TouchableOpacity>
            {replyCount > 0 && (
              <TouchableOpacity onPress={loadReplies}>
                <Text style={styles.viewReplies}>
                  {loadingReplies ? '...' : showReplies ? 'Hide replies' : `View ${replyCount} replies`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.commentLike} onPress={handleLike}>
          <Heart size={14} color={liked ? '#FF3B30' : '#555'} fill={liked ? '#FF3B30' : 'none'} strokeWidth={2} />
          {likeCount > 0 && <Text style={styles.commentLikeCount}>{likeCount}</Text>}
        </TouchableOpacity>
      </View>

      {/* Replies */}
      {showReplies && replies.map((r: any) => (
        <View key={r.id} style={styles.replyRow}>
          <CornerDownRight size={14} color="#333" style={{ marginTop: 2 }} />
          <View style={styles.replyAvatar}>
            {r.author?.avatar_url
              ? <Image source={{ uri: r.author.avatar_url }} style={styles.replyAvatarImg} />
              : <Text style={styles.commentAvatarLetter}>{(r.author?.username || '?')[0].toUpperCase()}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.commentText}>
              <Text style={styles.commentUsername}>{r.author?.username} </Text>
              {r.body}
            </Text>
            <Text style={styles.commentTime}>{timeAgo(r.created_at)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PostDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { postId, isReel: isReelParam } = route.params;
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ username: string; commentId: string } | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Determine if reel or post
  const isReel = !!isReelParam;

  const { data: post, isLoading } = useQuery({
    queryKey: ['post-detail', postId],
    queryFn: async () => {
      const res = await api.get(isReel ? `/reels/${postId}` : `/posts/${postId}`);
      return res.data;
    },
  });

  const { data: commentsData } = useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const res = await api.get(
        isReel ? `/reels/${postId}/comments` : `/posts/${postId}/comments`,
        { params: { limit: 50 } }
      );
      return res.data;
    },
  });

  const postComment = useMutation({
    mutationFn: async (body: string) => {
      const endpoint = isReel ? `/reels/${postId}/comments` : `/posts/${postId}/comments`;
      const payload: any = { body };
      if (replyTo) payload.parent_id = replyTo.commentId;
      await api.post(endpoint, payload);
    },
    onSuccess: () => {
      setComment('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      Keyboard.dismiss();
    },
  });

  const handleReply = (username: string, commentId: string) => {
    setReplyTo({ username, commentId });
    setComment(`@${username} `);
    inputRef.current?.focus();
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator color="#FF6B35" /></View>;
  if (!post) return <View style={styles.center}><Text style={styles.errText}>Not found</Text></View>;

  const imageUrl = post.media_keys?.length ? `${CDN}${post.media_keys[0]}` : null;
  const comments = Array.isArray(commentsData)
    ? commentsData
    : (commentsData?.comments ?? commentsData?.items ?? []);
  const avatarLetter = (post.author?.username || '?')[0].toUpperCase();
  const caption = post.caption || post.description;
  const trainNo = post.train_no || post.train_number;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isReel ? 'Reel' : 'Post'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CommentRow
              comment={item}
              postId={postId}
              isReel={isReel}
              onReply={handleReply}
            />
          )}
          ListHeaderComponent={
            <View>
              {/* Author row */}
              <View style={styles.authorRow}>
                <View style={styles.avatar}>
                  {post.author?.avatar_url
                    ? <Image source={{ uri: post.author.avatar_url }} style={styles.avatarImg} />
                    : <Text style={styles.avatarLetter}>{avatarLetter}</Text>}
                </View>
                <View>
                  <Text style={styles.username}>{post.author?.username}</Text>
                  {trainNo && <Text style={styles.trainTag}>🚆 {trainNo}</Text>}
                </View>
              </View>

              {imageUrl && <AutoImage uri={imageUrl} />}

              {caption && (
                <View style={styles.captionRow}>
                  <Text style={styles.captionText}>
                    <Text style={styles.captionUsername}>{post.author?.username} </Text>
                    {caption}
                  </Text>
                </View>
              )}

              <Text style={styles.timeAgo}>{timeAgo(post.created_at)}</Text>
              <View style={styles.divider} />
              <View style={styles.commentsHeader}>
                <MessageCircle size={14} color="#555" />
                <Text style={styles.commentsLabel}>Comments</Text>
              </View>
            </View>
          }
          ListFooterComponent={<View style={{ height: 80 }} />}
          showsVerticalScrollIndicator={false}
        />

        {/* Reply indicator */}
        {replyTo && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyIndicatorText}>Replying to @{replyTo.username}</Text>
            <TouchableOpacity onPress={() => { setReplyTo(null); setComment(''); }}>
              <Text style={styles.replyCancel}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Comment input */}
        <View style={[styles.commentInput, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Add a comment...'}
            placeholderTextColor="#555"
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity
            onPress={() => comment.trim() && postComment.mutate(comment.trim())}
            disabled={!comment.trim() || postComment.isPending}
          >
            {postComment.isPending
              ? <ActivityIndicator size="small" color="#FF6B35" />
              : <Send size={22} color={comment.trim() ? '#FF6B35' : '#444'} strokeWidth={2} />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errText: { color: '#888' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  username: { color: '#fff', fontWeight: '700', fontSize: 14 },
  trainTag: { color: '#FF6B35', fontSize: 11 },
  captionRow: { paddingHorizontal: 14, paddingTop: 12 },
  captionUsername: { color: '#fff', fontWeight: '700', fontSize: 14 },
  captionText: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  timeAgo: { color: '#444', fontSize: 11, paddingHorizontal: 14, marginTop: 6, marginBottom: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#1e1e1e' },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  commentsLabel: { color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  commentBlock: { paddingHorizontal: 14, paddingVertical: 6 },
  commentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  commentAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  commentAvatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  commentContent: { flex: 1 },
  commentUsername: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentText: { color: '#ccc', fontSize: 13, lineHeight: 18 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  commentTime: { color: '#444', fontSize: 11 },
  replyBtn: { color: '#888', fontSize: 12, fontWeight: '600' },
  viewReplies: { color: '#FF6B35', fontSize: 12, fontWeight: '600' },
  commentLike: { alignItems: 'center', gap: 2, paddingLeft: 8 },
  commentLikeCount: { color: '#555', fontSize: 11 },

  replyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8, marginLeft: 42 },
  replyAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  replyAvatarImg: { width: 24, height: 24, borderRadius: 12 },

  replyIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#111', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222',
  },
  replyIndicatorText: { color: '#888', fontSize: 13 },
  replyCancel: { color: '#555', fontSize: 16, paddingHorizontal: 8 },

  commentInput: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1e1e1e',
    backgroundColor: '#0a0a0a',
  },
  input: {
    flex: 1, color: '#fff', fontSize: 14,
    backgroundColor: '#151515', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, maxHeight: 80,
  },
});
