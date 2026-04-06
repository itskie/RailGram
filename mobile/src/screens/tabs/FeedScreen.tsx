import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Image, RefreshControl, StatusBar, useWindowDimensions,
  Animated, Modal, Pressable,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Heart, MessageCircle, Bookmark, Share2, MoreVertical, Bell, Plus, Clapperboard, ImagePlus, X } from 'lucide-react-native';
import Video from 'react-native-video';
import { api } from '../../api/client';
import StoriesRow from '../../components/StoriesRow';
import AutoImage from '../../components/AutoImage';
import CommentsSheet from '../../components/CommentsSheet';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

interface Post {
  id: string;
  item_type: 'post' | 'reel';
  caption: string | null;
  description: string | null;
  media_keys: string[] | null;
  hls_url: string | null;
  reel_thumbnail_url: string | null;
  train_no: string | null;
  train_number: string | null;
  like_count: number;
  likes_count: number;
  comment_count: number;
  comments_count: number;
  viewer_liked: boolean;
  viewer_bookmarked: boolean;
  viewer_saved: boolean;
  created_at: string;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null };
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

// ── REEL CARD ──────────────────────────────────────────────────────────────
function ReelCard({ item, navigation, isActive }: { item: Post; navigation: any; isActive: boolean }) {
  const { width } = useWindowDimensions();
  const reelHeight = width * (5 / 4);
  const [liked, setLiked] = useState(item.viewer_liked);
  const [likeCount, setLikeCount] = useState(item.like_count || item.likes_count || 0);
  const [bookmarked, setBookmarked] = useState(item.viewer_saved || item.viewer_bookmarked);
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const avatarLetter = (item.author?.username || '?')[0].toUpperCase();
  const trainNo = item.train_no || item.train_number;
  const caption = item.caption || item.description;
  const [commentCount, setCommentCount] = useState(item.comment_count || item.comments_count || 0);

  const handleLike = () => {
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    api.post(`/reels/${item.id}/like`).catch(() => {
      setLiked(l => !l);
      setLikeCount(c => liked ? c + 1 : c - 1);
    });
  };

  const handleSave = () => {
    setBookmarked(b => !b);
    api.post(`/reels/${item.id}/save`).catch(() => setBookmarked(b => !b));
  };

  return (
    <View style={{ width, height: reelHeight, backgroundColor: '#000', marginBottom: 1 }}>
      {/* Video fills entire card */}
      <TouchableOpacity activeOpacity={1} onPress={() => setPaused(p => !p)} style={StyleSheet.absoluteFill}>
        <Video
          source={{ uri: item.hls_url! }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat
          paused={paused || !isActive}
          muted={!isActive}
          poster={item.reel_thumbnail_url || undefined}
          ignoreSilentSwitch="ignore"
        />
      </TouchableOpacity>


      {/* TOP: avatar + username + time + Follow + ... */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 12 }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
          onPress={() => navigation.navigate('UserProfile', { username: item.author.username })}
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FF6B35', overflow: 'hidden', borderWidth: 1.5, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
            {item.author?.avatar_url
              ? <Image source={{ uri: item.author.avatar_url }} style={{ width: 34, height: 34, borderRadius: 17 }} />
              : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{avatarLetter}</Text>}
          </View>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{item.author?.username}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{timeAgo(item.created_at)}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={{ borderWidth: 1, borderColor: '#fff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Follow</Text>
          </TouchableOpacity>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MoreVertical size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* BOTTOM: train pill + caption + actions */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 14 }}>
        {trainNo && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,107,53,0.3)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,107,53,0.5)' }}>
            <Text style={{ color: '#FF6B35', fontSize: 12, fontWeight: '600' }}>🚆 {trainNo}</Text>
          </View>
        )}
        {caption ? <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginBottom: 10, lineHeight: 18 }} numberOfLines={2}>{caption}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} onPress={handleLike}>
              <Heart size={24} color={liked ? '#FF3B30' : '#fff'} fill={liked ? '#FF3B30' : 'none'} strokeWidth={2} />
              {likeCount > 0 && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{likeCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} onPress={() => setCommentsOpen(true)}>
              <MessageCircle size={24} color="#fff" strokeWidth={2} />
              {commentCount > 0 && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{commentCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity>
              <Share2 size={22} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleSave}>
            <Bookmark size={24} color={bookmarked ? '#FF6B35' : '#fff'} fill={bookmarked ? '#FF6B35' : 'none'} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <CommentsSheet
        type="reel"
        entityId={item.id}
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentCountChange={setCommentCount}
      />
    </View>
  );
}

// ── POST CARD ──────────────────────────────────────────────────────────────
function PostCard({ item, navigation }: { item: Post; navigation: any }) {
  const [liked, setLiked] = useState(item.viewer_liked);
  const [likeCount, setLikeCount] = useState(item.like_count || item.likes_count || 0);
  const [bookmarked, setBookmarked] = useState(item.viewer_bookmarked || item.viewer_saved);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const avatarLetter = (item.author?.username || '?')[0].toUpperCase();
  const imageUrl = item.media_keys?.length ? `${CDN}${item.media_keys[0]}` : null;
  const trainNo = item.train_no || item.train_number;
  const caption = item.caption || item.description;
  const [commentCount, setCommentCount] = useState(item.comment_count || item.comments_count || 0);

  const handleLike = () => {
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    api.post(`/posts/${item.id}/like`).catch(() => {
      setLiked(l => !l);
      setLikeCount(c => liked ? c + 1 : c - 1);
    });
  };

  const handleBookmark = () => {
    setBookmarked(b => !b);
    api.post(`/posts/${item.id}/bookmark`).catch(() => setBookmarked(b => !b));
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={() => navigation.navigate('UserProfile', { username: item.author.username })}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              {item.author?.avatar_url
                ? <Image source={{ uri: item.author.avatar_url }} style={styles.avatarImg} />
                : <Text style={styles.avatarLetter}>{avatarLetter}</Text>}
            </View>
          </View>
          <View style={styles.headerText}>
            <View style={styles.headerRow}>
              <Text style={styles.username}>{item.author?.username || 'unknown'}</Text>
              {trainNo && <View style={styles.trainPill}><Text style={styles.trainPillText}>🚆 {trainNo}</Text></View>}
            </View>
            <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MoreVertical size={18} color="#888" />
        </TouchableOpacity>
      </View>

      {caption && !imageUrl && <View style={styles.textOnlyCaption}><Text style={styles.textOnlyCaptionText}>{caption}</Text></View>}

      {imageUrl && (
        <TouchableOpacity activeOpacity={0.96} onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
          <AutoImage uri={imageUrl} />
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionChip} onPress={handleLike}>
          <Heart size={20} color={liked ? '#FF3B30' : '#ccc'} fill={liked ? '#FF3B30' : 'none'} strokeWidth={2} />
          {likeCount > 0 && <Text style={[styles.actionCount, liked && { color: '#FF3B30' }]}>{likeCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={() => setCommentsOpen(true)}>
          <MessageCircle size={20} color="#ccc" strokeWidth={2} />
          {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip}>
          <Share2 size={20} color="#ccc" strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleBookmark}>
          <Bookmark size={22} color={bookmarked ? '#FF6B35' : '#888'} fill={bookmarked ? '#FF6B35' : 'none'} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {caption && <View style={styles.captionRow}><Text style={styles.captionText} numberOfLines={2}><Text style={styles.captionUsername}>{item.author?.username} </Text>{caption}</Text></View>}
      {commentCount > 0 && (
        <TouchableOpacity onPress={() => setCommentsOpen(true)}>
          <Text style={styles.viewComments}>View all {commentCount} comments</Text>
        </TouchableOpacity>
      )}
      <View style={styles.divider} />

      <CommentsSheet
        type="post"
        entityId={item.id}
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentCountChange={setCommentCount}
      />
    </View>
  );
}

export default function FeedScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // Hide/show bars on scroll
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const topBarAnim = useRef(new Animated.Value(0)).current; // 0 = visible, -topBarH = hidden
  const TOP_BAR_H = 56 + insets.top;

  const handleScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    if (Math.abs(diff) < 4) return;
    if (diff > 0 && y > 60) {
      topBarAnim.setValue(-TOP_BAR_H);
    } else if (diff < 0) {
      topBarAnim.setValue(0);
    }
    lastScrollY.current = y;
  }, []);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const activeReel = viewableItems.find((v: any) => v.item?.hls_url);
    setActiveReelId(activeReel ? activeReel.item.id : null);
  }, []);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: ['feed'],
      queryFn: async ({ pageParam = null }) => {
        const params: any = { limit: 10 };
        if (pageParam) params.cursor = pageParam;
        const res = await api.get('/posts/feed/unified', { params });
        return res.data;
      },
      getNextPageParam: (last: any) => last.next_cursor || undefined,
      initialPageParam: null,
    });

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Image source={require('../../assets/logo.png')} style={{ width: 60, height: 60, marginBottom: 16 }} resizeMode="contain" />
        <ActivityIndicator color="#FF6B35" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Top Bar */}
      <Animated.View style={[styles.topBar, { paddingTop: insets.top + 6, transform: [{ translateY: topBarAnim }] }]}>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => setCreateMenuOpen(true)}>
          <Plus size={26} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Image source={require('../../assets/logo.png')} style={styles.topLogo} resizeMode="contain" />
          <Text style={styles.topTitle}>RailGram</Text>
        </View>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => navigation.navigate('Notifications')}>
          <Heart size={26} color="#fff" strokeWidth={1.6} />
        </TouchableOpacity>
      </Animated.View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => item.hls_url
          ? <ReelCard item={item} navigation={navigation} isActive={isFocused && item.id === activeReelId} />
          : <PostCard item={item} navigation={navigation} />
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6B35" />
        }
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={<StoriesRow navigation={navigation} />}
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color="#FF6B35" style={{ padding: 20 }} /> : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🚂</Text>
            <Text style={styles.empty}>No posts yet. Be the first railfan!</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Create menu */}
      <Modal visible={createMenuOpen} transparent animationType="fade" onRequestClose={() => setCreateMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setCreateMenuOpen(false)}>
          <Pressable style={[styles.menuSheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Create</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setCreateMenuOpen(false); navigation.navigate('CreatePost'); }}
            >
              <View style={styles.menuIcon}>
                <ImagePlus size={22} color="#FF6B35" strokeWidth={1.8} />
              </View>
              <View>
                <Text style={styles.menuItemTitle}>New Post</Text>
                <Text style={styles.menuItemSub}>Share rail photos</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setCreateMenuOpen(false); navigation.navigate('CreateReel'); }}
            >
              <View style={styles.menuIcon}>
                <Clapperboard size={22} color="#FF6B35" strokeWidth={1.8} />
              </View>
              <View>
                <Text style={styles.menuItemTitle}>New Reel</Text>
                <Text style={styles.menuItemSub}>Share a video reel</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCancel} onPress={() => setCreateMenuOpen(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
    backgroundColor: '#0a0a0a',
  },
  topCenter: { flexDirection: 'row', alignItems: 'center' },
  topLogo: { width: 28, height: 28, marginRight: 6 },
  topTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  topIconBtn: { padding: 4 },

  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
  },
  menuHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  menuTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  menuIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#1a0a00', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FF6B3530',
  },
  menuItemTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  menuItemSub: { color: '#555', fontSize: 12, marginTop: 2 },
  menuCancel: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  menuCancelText: { color: '#555', fontSize: 15, fontWeight: '600' },

  card: { backgroundColor: '#0a0a0a' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#1e1e1e', marginTop: 10 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { marginLeft: 10, flex: 1 },
  avatarWrapper: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: '#FF6B35',
    padding: 1.5, justifyContent: 'center', alignItems: 'center',
  },
  avatarCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  username: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  timeAgo: { color: '#555', fontSize: 11, marginTop: 1 },

  trainPill: {
    backgroundColor: '#1a0d00', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#FF6B3540',
  },
  trainPillText: { color: '#FF6B35', fontSize: 10, fontWeight: '600' },

  postImage: { width: '100%', backgroundColor: '#111' },
  reelContainer: { backgroundColor: '#000', overflow: 'hidden' },
  reelVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  reelPlayOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  reelPlayIcon: { color: '#fff', fontSize: 40, opacity: 0.9 },

  imageOverlayPill: {
    position: 'absolute', bottom: 10, left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.4)',
  },
  imageOverlayText: { color: '#FF6B35', fontSize: 11, fontWeight: '600' },

  textOnlyCaption: { paddingHorizontal: 14, paddingBottom: 10 },
  textOnlyCaptionText: { color: '#eee', fontSize: 15, lineHeight: 22 },

  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 4,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#151515', borderRadius: 20, marginRight: 6,
  },
  actionCount: { color: '#ccc', fontSize: 13, fontWeight: '600' },

  captionRow: { paddingHorizontal: 14, marginBottom: 4 },
  captionUsername: { color: '#fff', fontWeight: '700', fontSize: 13 },
  captionText: { color: '#ccc', fontSize: 13, lineHeight: 18 },

  viewComments: { color: '#555', fontSize: 12.5, paddingHorizontal: 14, marginBottom: 6 },

  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  empty: { color: '#444', fontSize: 15 },

  // Reel card (in feed) overlay styles
  reelCard: { backgroundColor: '#000' },
  reelGradientTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 56,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  reelGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  reelTopOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8,
  },
  reelAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  reelAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FF6B35', overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  reelAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  reelAvatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  reelUsername: { color: '#fff', fontWeight: '700', fontSize: 13 },
  reelTime: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  reelTopRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reelFollowBtn: {
    borderWidth: 1, borderColor: '#fff', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  reelFollowText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  reelBottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 12, paddingBottom: 14,
  },
  reelTrainPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,107,53,0.3)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.5)',
  },
  reelTrainText: { color: '#FF6B35', fontSize: 11, fontWeight: '600' },
  reelActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reelActionsLeft: { flexDirection: 'row', gap: 16 },
  reelActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reelActionCount: { color: '#fff', fontSize: 13, fontWeight: '600' },
  reelCaption: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18, marginBottom: 10 },
});
