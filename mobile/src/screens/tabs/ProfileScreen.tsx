import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, FlatList, useWindowDimensions, ActionSheetIOS, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Settings, LogOut, Grid3x3, Clapperboard, Bookmark, PlusSquare, MessageCircle } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

type Tab = 'posts' | 'reels' | 'saved';

export default function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  const handleSettings = () => {
    const options = ['Edit Profile', 'Follow Requests', 'Blocked Users', 'Leaderboard', 'Messages', 'Cancel'];
    const cancelIdx = 5;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: cancelIdx }, (idx) => {
        if (idx === 0) navigation?.navigate('EditProfile');
        else if (idx === 1) navigation?.navigate('FollowRequests');
        else if (idx === 2) navigation?.navigate('BlockedUsers');
        else if (idx === 3) navigation?.navigate('Leaderboard');
        else if (idx === 4) navigation?.navigate('ChatList');
      });
    } else {
      Alert.alert('Settings', undefined, [
        { text: 'Edit Profile', onPress: () => navigation?.navigate('EditProfile') },
        { text: 'Follow Requests', onPress: () => navigation?.navigate('FollowRequests') },
        { text: 'Blocked Users', onPress: () => navigation?.navigate('BlockedUsers') },
        { text: 'Leaderboard', onPress: () => navigation?.navigate('Leaderboard') },
        { text: 'Messages', onPress: () => navigation?.navigate('ChatList') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };
  const THUMB = (width - 3) / 3;

  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get(`/users/${user?.username}`);
      return res.data;
    },
    enabled: !!user?.username,
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['user-posts', user?.username],
    queryFn: async () => {
      const res = await api.get(`/users/${user?.username}/posts`, { params: { limit: 30 } });
      return res.data?.posts ?? res.data?.items ?? res.data ?? [];
    },
    enabled: !!user?.username && activeTab === 'posts',
  });

  const { data: reelsData, isLoading: reelsLoading } = useQuery({
    queryKey: ['user-reels', user?.id],
    queryFn: async () => {
      const res = await api.get(`/reels/user/${user?.id}`);
      return res.data?.items ?? [];
    },
    enabled: !!user?.id && activeTab === 'reels',
  });

  const { data: savedPostsData } = useQuery({
    queryKey: ['saved-posts'],
    queryFn: async () => {
      const res = await api.get('/posts/bookmarked');
      return res.data?.posts ?? res.data?.items ?? [];
    },
    enabled: activeTab === 'saved',
  });

  const { data: savedReelsData } = useQuery({
    queryKey: ['saved-reels'],
    queryFn: async () => {
      const res = await api.get('/reels/saved');
      return res.data?.items ?? [];
    },
    enabled: activeTab === 'saved',
  });

  if (!user) return <View style={s.center}><ActivityIndicator color="#FF6B35" /></View>;

  const profile = profileData ?? user;
  const avatarLetter = user.username[0].toUpperCase();

  const posts = postsData ?? [];
  const reels = reelsData ?? [];
  const savedPosts = savedPostsData ?? [];
  const savedReels = savedReelsData ?? [];
  const savedItems = [...savedPosts, ...savedReels];

  const gridData = activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : savedItems;
  const isLoading = activeTab === 'posts' ? postsLoading : activeTab === 'reels' ? reelsLoading : false;

  const renderThumb = ({ item }: { item: any }) => {
    const isReel = !!item.hls_url || item.item_type === 'reel';
    const imageUrl = isReel
      ? (item.thumbnail_url || item.reel_thumbnail_url || null)
      : (item.media_keys?.length ? `${CDN}${item.media_keys[0]}` : null);

    return (
      <TouchableOpacity
        style={[s.thumb, { width: THUMB, height: THUMB }]}
        onPress={() => navigation?.navigate(isReel ? 'PostDetail' : 'PostDetail', { postId: item.id, isReel })}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={s.thumbImg} resizeMode="cover" />
        ) : (
          <View style={[s.thumbPlaceholder, isReel && s.thumbReelBg]}>
            {isReel && <Clapperboard size={22} color="#FF6B35" strokeWidth={1.5} />}
            <Text style={s.thumbPlaceholderText} numberOfLines={2}>
              {item.caption || item.title || item.description || ''}
            </Text>
          </View>
        )}
        {isReel && imageUrl && (
          <View style={s.reelBadge}>
            <Clapperboard size={12} color="#fff" strokeWidth={2} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={gridData}
      keyExtractor={(item) => item.id}
      numColumns={3}
      renderItem={renderThumb}
      columnWrapperStyle={{ gap: 1.5 }}
      ItemSeparatorComponent={() => <View style={{ height: 1.5 }} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ paddingBottom: 8 }}>
          {/* Top bar */}
          <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
            <Text style={s.topUsername}>@{user.username}</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={() => navigation?.navigate('ChatList')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MessageCircle size={22} color="#fff" strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation?.navigate('CreatePost')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <PlusSquare size={22} color="#fff" strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSettings} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Settings size={22} color="#fff" strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <LogOut size={22} color="#ff4444" strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar + stats */}
          <View style={s.profileSection}>
            <View style={[s.storyRing, profile.has_active_story && s.storyRingActive]}>
              <View style={s.avatarWrapper}>
                {user.avatar_url
                  ? <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
                  : <Text style={s.avatarText}>{avatarLetter}</Text>}
              </View>
            </View>
            <View style={s.statsRow}>
              <View style={s.stat}>
                <Text style={s.statNum}>{profile.post_count ?? posts.length ?? 0}</Text>
                <Text style={s.statLabel}>Posts</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{profile.follower_count ?? 0}</Text>
                <Text style={s.statLabel}>Followers</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{profile.following_count ?? 0}</Text>
                <Text style={s.statLabel}>Following</Text>
              </View>
            </View>
          </View>

          {/* Bio */}
          <View style={s.bioSection}>
            {user.display_name && <Text style={s.displayName}>{user.display_name}</Text>}
            {user.bio && <Text style={s.bio}>{user.bio}</Text>}
            <View style={[s.karmaPill]}>
              <Text style={s.karmaText}>⚡ {user.karma} karma</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            <TouchableOpacity style={[s.tab, activeTab === 'posts' && s.tabActive]} onPress={() => setActiveTab('posts')}>
              <Grid3x3 size={20} color={activeTab === 'posts' ? '#FF6B35' : '#555'} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.tab, activeTab === 'reels' && s.tabActive]} onPress={() => setActiveTab('reels')}>
              <Clapperboard size={20} color={activeTab === 'reels' ? '#FF6B35' : '#555'} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.tab, activeTab === 'saved' && s.tabActive]} onPress={() => setActiveTab('saved')}>
              <Bookmark size={20} color={activeTab === 'saved' ? '#FF6B35' : '#555'} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>

          {isLoading && <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />}
          {!isLoading && gridData.length === 0 && (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>
                {activeTab === 'posts' ? 'No posts yet' : activeTab === 'reels' ? 'No reels yet' : 'Nothing saved yet'}
              </Text>
            </View>
          )}
        </View>
      }
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      style={s.container}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  topUsername: { color: '#fff', fontSize: 20, fontWeight: '800' },

  profileSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 20,
  },
  storyRing: {
    width: 92, height: 92, borderRadius: 46, padding: 3,
    borderWidth: 2.5, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  storyRingActive: { borderColor: '#FF6B35' },
  avatarWrapper: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 82, height: 82, borderRadius: 41 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },

  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#666', fontSize: 12, marginTop: 2 },

  bioSection: { paddingHorizontal: 16, paddingBottom: 16 },
  displayName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  bio: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  karmaPill: {
    alignSelf: 'flex-start', backgroundColor: '#1a1200',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FF6B3540',
  },
  karmaText: { color: '#FF6B35', fontSize: 11, fontWeight: '600' },

  tabs: {
    flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1e1e1e', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#FF6B35' },

  thumb: { backgroundColor: '#111', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 6, gap: 4 },
  thumbReelBg: { backgroundColor: '#1a0a00' },
  thumbPlaceholderText: { color: '#555', fontSize: 10, textAlign: 'center' },
  reelBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 3,
  },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#444', fontSize: 14 },
});
