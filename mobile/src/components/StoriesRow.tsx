import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Modal, StatusBar, Animated, useWindowDimensions, TextInput,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Eye, Trash2 } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';
const PHOTO_DURATION = 5000;
const REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '🔥', '👏', '🚂'];

interface StoryOut {
  id: string;
  media_key: string;
  media_type: string; // photo | video
  duration_secs?: number;
  thumbnail_key?: string;
  caption?: string;
  expires_at: string;
  view_count: number;
  reaction_count: number;
  viewed: boolean;
  viewer_reaction?: string;
  author: { id: string; username: string; display_name: string; avatar_url?: string };
}

interface StoryFeedItem {
  user: { id: string; username: string; display_name: string; avatar_url?: string };
  stories: StoryOut[];
}

// ── Story Viewer ──────────────────────────────────────────────────────────────

function StoryViewerModal({
  feedItems,
  startIndex,
  onClose,
  currentUsername,
}: {
  feedItems: StoryFeedItem[];
  startIndex: number;
  onClose: () => void;
  currentUsername?: string;
}) {
  const qc = useQueryClient();
  const { width, height } = useWindowDimensions();
  const [userIndex, setUserIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const currentFeed = feedItems[userIndex];
  const currentStory = currentFeed?.stories[storyIndex];
  const isOwn = currentFeed?.user.username === currentUsername;
  const isVideo = currentStory?.media_type === 'video';
  const duration = isVideo ? ((currentStory?.duration_secs ?? 15) * 1000) : PHOTO_DURATION;

  const reactMut = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
      api.post(`/stories/${id}/react`, { emoji }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories-feed'] });
      setShowReactions(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/stories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories-feed'] });
      goNext();
    },
  });

  const startProgress = useCallback(() => {
    progress.setValue(0);
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => { if (finished) goNext(); });
  }, [userIndex, storyIndex, duration]);

  useEffect(() => {
    startProgress();
    if (currentStory && !currentStory.viewed) {
      api.get(`/stories/${currentStory.id}`).catch(() => {});
    }
    return () => animRef.current?.stop();
  }, [userIndex, storyIndex]);

  const goNext = useCallback(() => {
    animRef.current?.stop();
    if (storyIndex < currentFeed.stories.length - 1) {
      setStoryIndex(i => i + 1);
    } else if (userIndex < feedItems.length - 1) {
      setUserIndex(i => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [storyIndex, userIndex, currentFeed, feedItems]);

  const goPrev = useCallback(() => {
    animRef.current?.stop();
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
    } else if (userIndex > 0) {
      setUserIndex(i => i - 1);
      setStoryIndex(0);
    }
  }, [storyIndex, userIndex]);

  const handleDelete = () => {
    Alert.alert('Delete Story', 'Delete this story?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(currentStory.id) },
    ]);
  };

  if (!currentStory || !currentFeed) return null;

  const mediaUrl = `${CDN}${currentStory.media_key}`;
  const avatarUrl = currentFeed.user.avatar_url
    ? (currentFeed.user.avatar_url.startsWith('http') ? currentFeed.user.avatar_url : `${CDN}${currentFeed.user.avatar_url}`)
    : null;
  const letter = currentFeed.user.username[0].toUpperCase();

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={[sv.container, { width, height }]}>
        {/* Media */}
        <Image source={{ uri: mediaUrl }} style={sv.image} resizeMode="cover" onLoad={startProgress} />

        {/* Gradient */}
        <View style={sv.gradientTop} />
        <View style={sv.gradientBottom} />

        {/* Progress bars */}
        <View style={sv.progressRow}>
          {currentFeed.stories.map((_, i) => (
            <View key={i} style={sv.progressBg}>
              <Animated.View
                style={[sv.progressFill, {
                  width: i < storyIndex ? '100%' : i === storyIndex
                    ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                    : '0%',
                }]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={sv.header}>
          <View style={sv.userInfo}>
            <View style={sv.avatarCircle}>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} style={sv.avatarImg} /> : <Text style={sv.avatarLetter}>{letter}</Text>}
            </View>
            <View>
              <Text style={sv.username}>{currentFeed.user.username}</Text>
              <Text style={sv.timeLeft}>
                {Math.max(0, Math.round((new Date(currentStory.expires_at).getTime() - Date.now()) / 3600000))}h left
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {isOwn && (
              <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={18} color="#ff6b6b" strokeWidth={2} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={22} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Caption */}
        {currentStory.caption && (
          <View style={sv.captionContainer}>
            <Text style={sv.caption}>{currentStory.caption}</Text>
          </View>
        )}

        {/* Bottom bar */}
        <View style={sv.bottomBar}>
          {isOwn ? (
            <View style={sv.viewCount}>
              <Eye size={14} color="#fff" strokeWidth={2} />
              <Text style={sv.viewCountText}>{currentStory.view_count} views</Text>
              {currentStory.reaction_count > 0 && (
                <Text style={sv.viewCountText}>· {currentStory.reaction_count} reacts</Text>
              )}
            </View>
          ) : showReactions ? (
            <View style={sv.reactionsRow}>
              {REACTIONS.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => reactMut.mutate({ id: currentStory.id, emoji })}>
                  <Text style={[sv.reactionEmoji, currentStory.viewer_reaction === emoji && sv.reactionActive]}>
                    {emoji}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowReactions(false)}>
                <Text style={{ color: '#aaa', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={sv.reactBtn} onPress={() => setShowReactions(true)}>
              <Text style={sv.reactBtnText}>{currentStory.viewer_reaction || '😊'} React</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tap zones */}
        <View style={sv.tapRow}>
          <TouchableOpacity style={sv.tapLeft} onPress={goPrev} />
          <TouchableOpacity style={sv.tapRight} onPress={goNext} />
        </View>
      </View>
    </Modal>
  );
}

// ── Story Create Modal ────────────────────────────────────────────────────────

function StoryCreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickMedia = () => {
    launchImageLibrary({ mediaType: 'mixed', quality: 0.9 }, (res) => {
      if (res.didCancel || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setMediaUri(asset.uri!);
      const isVid = asset.type?.startsWith('video/') ?? false;
      setMediaType(isVid ? 'video' : 'photo');
      setMimeType(asset.type || 'image/jpeg');
    });
  };

  const handleShare = async () => {
    if (!mediaUri) return;
    setUploading(true);
    try {
      const ext = mediaUri.split('.').pop() || 'jpg';
      const presignRes = await api.post('/media/presign', {
        filename: `story.${ext}`,
        content_type: mimeType,
        purpose: 'story',
      });
      const { upload_url, key } = presignRes.data;

      const formData = new FormData();
      formData.append('file', { uri: mediaUri, type: mimeType, name: `story.${ext}` } as any);
      await fetch(upload_url, { method: 'PUT', body: formData, headers: { 'Content-Type': mimeType } });

      await api.post('/stories', {
        media_key: key,
        media_type: mediaType,
        caption: caption.trim() || undefined,
      });

      qc.invalidateQueries({ queryKey: ['stories-feed'] });
      onClose();
    } catch {
      Alert.alert('Error', 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={sc.container}>
        {/* Header */}
        <View style={sc.header}>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={sc.title}>Add to Story</Text>
          <TouchableOpacity
            onPress={handleShare}
            disabled={!mediaUri || uploading}
            style={[sc.shareBtn, (!mediaUri || uploading) && { opacity: 0.4 }]}
          >
            {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={sc.shareBtnText}>Share</Text>}
          </TouchableOpacity>
        </View>

        {/* Preview */}
        <TouchableOpacity style={sc.preview} onPress={pickMedia} activeOpacity={0.8}>
          {mediaUri ? (
            <Image source={{ uri: mediaUri }} style={sc.previewImg} resizeMode="cover" />
          ) : (
            <View style={sc.pickZone}>
              <Plus size={44} color="#555" strokeWidth={1.5} />
              <Text style={sc.pickText}>Tap to add photo or video</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Caption */}
        <View style={sc.captionRow}>
          <TextInput
            style={sc.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption..."
            placeholderTextColor="#555"
            maxLength={300}
          />
        </View>

        {mediaUri && (
          <TouchableOpacity style={sc.changeBtn} onPress={pickMedia}>
            <Text style={sc.changeBtnText}>Change media</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

// ── Stories Row ───────────────────────────────────────────────────────────────

export default function StoriesRow() {
  const { user } = useAuthStore();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: feedItems = [] } = useQuery<StoryFeedItem[]>({
    queryKey: ['stories-feed'],
    queryFn: async () => {
      const res = await api.get('/stories/feed');
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const myStory = feedItems.find(f => f.user.username === user?.username);
  const others = feedItems.filter(f => f.user.username !== user?.username);
  const ordered: StoryFeedItem[] = myStory ? [myStory, ...others] : feedItems;

  const openStory = (feedItem: StoryFeedItem) => {
    const idx = ordered.indexOf(feedItem);
    setViewerStart(idx);
    setViewerOpen(true);
  };

  const avatarLetter = (user?.username || 'U')[0].toUpperCase();

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={styles.rowContent}
      >
        {/* Your Story */}
        <TouchableOpacity
          style={styles.item}
          onPress={() => myStory ? openStory(myStory) : setCreateOpen(true)}
        >
          <View style={[styles.ringWrapper, myStory ? styles.activeRing : styles.addRing]}>
            <View style={styles.avatarCircle}>
              {user?.avatar_url
                ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                : <Text style={styles.avatarLetter}>{avatarLetter}</Text>}
            </View>
            {!myStory && (
              <View style={styles.plusBadge}>
                <Plus size={10} color="#fff" strokeWidth={3} />
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>Your story</Text>
        </TouchableOpacity>

        {/* Add more if I have a story */}
        {myStory && (
          <TouchableOpacity style={styles.item} onPress={() => setCreateOpen(true)}>
            <View style={[styles.ringWrapper, styles.addRing]}>
              <View style={[styles.avatarCircle, { backgroundColor: '#1a1a1a' }]}>
                <Plus size={22} color="#555" strokeWidth={2} />
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>Add more</Text>
          </TouchableOpacity>
        )}

        {/* Others */}
        {others.map((feedItem) => {
          const allViewed = feedItem.stories.every(s => s.viewed);
          const avatarUrl = feedItem.user.avatar_url
            ? (feedItem.user.avatar_url.startsWith('http') ? feedItem.user.avatar_url : `${CDN}${feedItem.user.avatar_url}`)
            : null;
          const al = feedItem.user.username[0].toUpperCase();
          return (
            <TouchableOpacity key={feedItem.user.id} style={styles.item} onPress={() => openStory(feedItem)}>
              <View style={[styles.ringWrapper, allViewed ? styles.viewedRing : styles.activeRing]}>
                <View style={styles.avatarCircle}>
                  {avatarUrl
                    ? <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                    : <Text style={styles.avatarLetter}>{al}</Text>}
                </View>
              </View>
              <Text style={styles.label} numberOfLines={1}>{feedItem.user.username}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {viewerOpen && ordered.length > 0 && (
        <StoryViewerModal
          feedItems={ordered}
          startIndex={viewerStart}
          onClose={() => setViewerOpen(false)}
          currentUsername={user?.username}
        />
      )}

      {createOpen && <StoryCreateModal onClose={() => setCreateOpen(false)} />}
    </>
  );
}

const AVATAR = 62;

const styles = StyleSheet.create({
  row: { backgroundColor: '#0a0a0a', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e' },
  rowContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
  item: { alignItems: 'center', width: AVATAR + 8 },
  ringWrapper: {
    width: AVATAR + 4, height: AVATAR + 4, borderRadius: (AVATAR + 4) / 2,
    padding: 2.5, justifyContent: 'center', alignItems: 'center',
  },
  activeRing: { borderWidth: 2.5, borderColor: '#FF6B35' },
  viewedRing: { borderWidth: 2, borderColor: '#333' },
  addRing: { borderWidth: 1.5, borderColor: '#2a2a2a' },
  avatarCircle: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  plusBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0a0a0a',
  },
  label: { color: '#ccc', fontSize: 10, marginTop: 4, textAlign: 'center', width: AVATAR + 8 },
});

const sv = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { position: 'absolute', width: '100%', height: '100%' },
  gradientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.5)' },
  gradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.5)' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 52 },
  progressBg: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 1, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FF6B35', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  username: { color: '#fff', fontWeight: '600', fontSize: 13 },
  timeLeft: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 },
  captionContainer: { position: 'absolute', bottom: 70, left: 0, right: 0, paddingHorizontal: 16 },
  caption: { color: '#fff', fontSize: 14, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 4 },
  bottomBar: { position: 'absolute', bottom: 30, left: 16, right: 16 },
  viewCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewCountText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  reactionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 30, paddingHorizontal: 12, paddingVertical: 8 },
  reactionEmoji: { fontSize: 22 },
  reactionActive: { transform: [{ scale: 1.2 }] },
  reactBtn: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start' },
  reactBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tapRow: { position: 'absolute', top: 80, bottom: 80, left: 0, right: 0, flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
});

const sc = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#1e1e1e' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  shareBtn: { backgroundColor: '#FF6B35', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  shareBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  preview: { flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a' },
  previewImg: { width: '100%', height: '100%' },
  pickZone: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  pickText: { color: '#555', fontSize: 14 },
  captionRow: { paddingHorizontal: 16, paddingBottom: 12 },
  captionInput: { backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15 },
  changeBtn: { marginHorizontal: 16, marginBottom: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1a1a1a', alignItems: 'center' },
  changeBtnText: { color: '#aaa', fontSize: 14 },
});
