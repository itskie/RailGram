import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, ActivityIndicator, Alert, ScrollView, RefreshControl,
  Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { usersApi, gamificationApi, postsApi, reelsApi } from '../../api/client';
import type { Post } from '../../types';
import type { ReelFeedResponse } from '../../features/reels/types/reel';
import type { TabScreenProps } from '../../navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { Grid, Play, Bookmark } from 'lucide-react-native';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const GRID_ITEM_WIDTH = width / 3 - 2;

// ── Post Grid Item ────────────────────────────────────────────────────────────
function PostGridItem({ post, onPress }: { post: Post; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.gridItem} onPress={onPress}>
      {post.media_urls[0] ? (
        <Image source={{ uri: post.media_urls[0] }} style={styles.gridImage} />
      ) : (
        <View style={[styles.gridImage, styles.gridNoImage]}>
          <Text style={{ fontSize: 20 }}>🖼️</Text>
        </View>
      )}
      <View style={styles.gridOverlay}>
        <View style={styles.gridStat}>
          <Text style={styles.gridStatIcon}>❤️</Text>
          <Text style={styles.gridStatText}>{post.like_count}</Text>
        </View>
        <View style={styles.gridStat}>
          <Text style={styles.gridStatIcon}>💬</Text>
          <Text style={styles.gridStatText}>{post.comment_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Reel Grid Item ────────────────────────────────────────────────────────────
function ReelGridItem({ reel, onPress }: { reel: ReelFeedResponse['items'][0]; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.gridItem} onPress={onPress}>
      {reel.thumbnail_url ? (
        <Image source={{ uri: reel.thumbnail_url }} style={styles.gridImage} />
      ) : (
        <View style={[styles.gridImage, styles.gridNoImage]}>
          <Play size={32} color="#fff" fill="#fff" />
        </View>
      )}
      <View style={styles.gridOverlay}>
        <View style={styles.gridStat}>
          <Text style={styles.gridStatIcon}>👁️</Text>
          <Text style={styles.gridStatText}>{reel.views}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Posts Tab ─────────────────────────────────────────────────────────────────
function PostsTab({ username, onPostPress }: { username: string; onPostPress: (id: string) => void }) {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => usersApi.posts(username),
  });

  if (isLoading) return <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />;
  if (!posts?.length) return <Text style={styles.emptyText}>No posts yet</Text>;

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      numColumns={3}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <PostGridItem post={item} onPress={() => onPostPress(item.id)} />
      )}
    />
  );
}

// ── Reels Tab ─────────────────────────────────────────────────────────────────
function ReelsTab({ userId, onReelPress }: { userId: string; onReelPress: (id: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-reels', userId],
    queryFn: () => reelsApi.user(userId),
  });

  if (isLoading) return <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />;
  if (!data?.items?.length) return <Text style={styles.emptyText}>No reels yet</Text>;

  return (
    <FlatList
      data={data.items}
      keyExtractor={(r) => r.id}
      numColumns={3}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <ReelGridItem reel={item} onPress={() => onReelPress(item.id)} />
      )}
    />
  );
}

// ── Saved Tab ─────────────────────────────────────────────────────────────────
function SavedTab({ onPostPress, onReelPress }: { onPostPress: (id: string) => void; onReelPress: (id: string) => void }) {
  const { data: savedPosts, isLoading: postsLoading } = useQuery({
    queryKey: ['saved-posts'],
    queryFn: () => postsApi.bookmarked(),
  });

  const { data: savedReels, isLoading: reelsLoading } = useQuery({
    queryKey: ['saved-reels'],
    queryFn: () => reelsApi.saved(),
  });

  const isLoading = postsLoading || reelsLoading;
  const hasPosts = savedPosts?.posts?.length ?? 0;
  const hasReels = savedReels?.items?.length ?? 0;

  if (isLoading) return <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />;
  if (!hasPosts && !hasReels) return <Text style={styles.emptyText}>No saved items yet</Text>;

  return (
    <View>
      {hasPosts > 0 && (
        <>
          <Text style={styles.sectionSubtitle}>Saved Posts</Text>
          <FlatList
            data={savedPosts?.posts}
            keyExtractor={(p) => p.id}
            numColumns={3}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <PostGridItem post={item} onPress={() => onPostPress(item.id)} />
            )}
          />
        </>
      )}
      {hasReels > 0 && (
        <>
          <Text style={styles.sectionSubtitle}>Saved Reels</Text>
          <FlatList
            data={savedReels?.items}
            keyExtractor={(r) => r.id}
            numColumns={3}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <ReelGridItem reel={item} onPress={() => onReelPress(item.id)} />
            )}
          />
        </>
      )}
    </View>
  );
}

// ── Main Profile Screen ───────────────────────────────────────────────────────
export default function ProfileScreen(_: TabScreenProps<'Profile'>) {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');

  const { data: stats } = useQuery({
    queryKey: ['user-stats', user?.username],
    queryFn: () => gamificationApi.stats(user!.username),
    enabled: !!user,
  });

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  }

  const handlePostPress = (postId: string) => {
    navigation.navigate('PostDetail', { postId });
  };

  const handleReelPress = (reelId: string) => {
    navigation.navigate('ReelDetail', { reelId });
  };

  if (!user) return <ActivityIndicator style={{ flex: 1 }} color="#E53935" />;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarLargeImg} />
          ) : (
            <View style={[styles.avatarLarge, styles.avatarLargePlaceholder]}>
              <Text style={styles.avatarLargeText}>{user.display_name[0].toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={styles.displayName}>{user.display_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{user.follower_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{user.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{user.karma_points}</Text>
          <Text style={styles.statLabel}>Karma</Text>
        </View>
        {stats && (
          <View style={styles.stat}>
            <Text style={styles.statNum}>{stats.streak_days}</Text>
            <Text style={styles.statLabel}>Streak 🔥</Text>
          </View>
        )}
      </View>

      {/* Badges */}
      {stats?.badges && stats.badges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesList}>
            {stats.badges.map((b) => (
              <View key={b.id} style={styles.badgeItem}>
                <Text style={styles.badgeIcon}>{b.icon_url ?? '🏅'}</Text>
                <Text style={styles.badgeName} numberOfLines={1}>{b.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('StoryCreation')}
        >
          <Text style={styles.primaryBtnText}>+ Create Story</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Leaderboard')}
        >
          <Text style={styles.secondaryBtnText}>🏆 Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
          onPress={() => setActiveTab('posts')}
        >
          <Grid size={20} color={activeTab === 'posts' ? '#E53935' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reels' && styles.activeTab]}
          onPress={() => setActiveTab('reels')}
        >
          <Play size={20} color={activeTab === 'reels' ? '#E53935' : '#888'} fill={activeTab === 'reels' ? '#E53935' : 'none'} />
          <Text style={[styles.tabText, activeTab === 'reels' && styles.activeTabText]}>Reels</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
          onPress={() => setActiveTab('saved')}
        >
          <Bookmark size={20} color={activeTab === 'saved' ? '#E53935' : '#888'} fill={activeTab === 'saved' ? '#E53935' : 'none'} />
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>Saved</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'posts' && (
          <PostsTab username={user.username} onPostPress={handlePostPress} />
        )}
        {activeTab === 'reels' && (
          <ReelsTab userId={user.id} onReelPress={handleReelPress} />
        )}
        {activeTab === 'saved' && (
          <SavedTab onPostPress={handlePostPress} onReelPress={handleReelPress} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'center', padding: 24, paddingTop: 32 },
  avatarLarge: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    overflow: 'hidden',
  },
  avatarLargePlaceholder: {
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLargeImg: { width: 88, height: 88, borderRadius: 44 },
  avatarLargeText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  displayName: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  username: { fontSize: 14, color: '#888', marginTop: 2 },
  bio: { fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  badgesSection: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 10 },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', color: '#666', marginVertical: 10, paddingHorizontal: 16 },
  badgesList: { gap: 12 },
  badgeItem: { alignItems: 'center', width: 60 },
  badgeIcon: { fontSize: 28 },
  badgeName: { fontSize: 10, color: '#666', textAlign: 'center', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, padding: 16 },
  primaryBtn: {
    flex: 1, backgroundColor: '#E53935', borderRadius: 8,
    padding: 10, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondaryBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E53935', borderRadius: 8,
    padding: 10, alignItems: 'center',
  },
  secondaryBtnText: { color: '#E53935', fontSize: 14, fontWeight: '600' },
  logoutBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#ccc', borderRadius: 8,
    padding: 10, alignItems: 'center',
  },
  logoutBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#f0f0f0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#E53935' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#888' },
  activeTabText: { color: '#E53935' },
  tabContent: { minHeight: 300 },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 14, marginTop: 32 },
  gridItem: { width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH, margin: 1, position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridNoImage: { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row',
    paddingHorizontal: 6, paddingVertical: 4, gap: 8,
  },
  gridStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridStatIcon: { fontSize: 12, color: '#fff' },
  gridStatText: { fontSize: 11, color: '#fff', fontWeight: '600' },
});
