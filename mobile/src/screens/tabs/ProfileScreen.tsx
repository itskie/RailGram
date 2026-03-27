import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { usersApi, gamificationApi } from '../../api/client';
import type { Post } from '../../types';
import type { TabScreenProps } from '../../navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function PostGrid({ username }: { username: string }) {
  const navigation = useNavigation<Nav>();
  const { data: posts, isLoading } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => usersApi.posts(username),
  });

  if (isLoading) return <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />;
  if (!posts?.length) return <Text style={styles.emptyPosts}>No posts yet</Text>;

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      numColumns={3}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        >
          {item.media_urls[0] ? (
            <Image source={{ uri: item.media_urls[0] }} style={styles.gridImage} />
          ) : (
            <View style={[styles.gridImage, styles.gridNoImage]}>
              <Text style={{ fontSize: 20 }}>🖼️</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

export default function ProfileScreen(_: TabScreenProps<'Profile'>) {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuthStore();

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

  if (!user) return <ActivityIndicator style={{ flex: 1 }} color="#E53935" />;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarLargeImg} />
          ) : (
            <Text style={styles.avatarLargeText}>{user.display_name[0].toUpperCase()}</Text>
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

      {/* Posts grid */}
      <View style={styles.postsSection}>
        <Text style={styles.sectionTitle}>Posts</Text>
        <PostGrid username={user.username} />
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
  postsSection: { padding: 16 },
  emptyPosts: { textAlign: 'center', color: '#999', fontSize: 14, marginTop: 24 },
  gridItem: { flex: 1 / 3, margin: 1 },
  gridImage: { width: '100%', aspectRatio: 1 },
  gridNoImage: { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
});
