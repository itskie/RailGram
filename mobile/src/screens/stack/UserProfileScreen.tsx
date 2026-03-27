import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/client';
import type { Post } from '../../types';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

type Props = RootStackScreenProps<'UserProfile'>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { username } = route.params;
  const { user: me } = useAuthStore();
  const queryClient = useQueryClient();
  const isOwnProfile = me?.username === username;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.profile(username),
  });

  const { data: posts, isLoading: loadingPosts } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => usersApi.posts(username),
  });

  const followMutation = useMutation({
    mutationFn: () => profile?.follower_count !== undefined
      ? usersApi.follow(username)
      : usersApi.unfollow(username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', username] }),
  });

  // Determine if current user follows this profile
  // (the backend should return this, for now we track locally)
  const [isFollowing, setIsFollowing] = React.useState(false);

  async function toggleFollow() {
    try {
      if (isFollowing) {
        await usersApi.unfollow(username);
        setIsFollowing(false);
      } else {
        await usersApi.follow(username);
        setIsFollowing(true);
      }
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#E53935" /></View>;
  }
  if (!profile) {
    return <View style={styles.centered}><Text style={styles.errorText}>User not found</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{profile.display_name[0].toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.follower_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.karma_points}</Text>
          <Text style={styles.statLabel}>Karma</Text>
        </View>
      </View>

      {/* Follow button */}
      {!isOwnProfile && (
        <View style={styles.followSection}>
          <TouchableOpacity
            style={isFollowing ? styles.followingBtn : styles.followBtn}
            onPress={toggleFollow}
          >
            <Text style={isFollowing ? styles.followingBtnText : styles.followBtnText}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Private profile notice */}
      {profile.is_private && !isFollowing && !isOwnProfile ? (
        <View style={styles.privateNotice}>
          <Text style={styles.privateIcon}>🔒</Text>
          <Text style={styles.privateText}>This account is private</Text>
          <Text style={styles.privateSubtext}>Follow to see their posts</Text>
        </View>
      ) : (
        <View style={styles.postsSection}>
          {loadingPosts ? (
            <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />
          ) : (
            <FlatList
              data={posts ?? []}
              keyExtractor={(p) => p.id}
              numColumns={3}
              scrollEnabled={false}
              renderItem={({ item }: { item: Post }) => (
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
              ListEmptyComponent={
                <Text style={styles.noPostsText}>No posts yet</Text>
              }
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#666', fontSize: 16 },
  header: { alignItems: 'center', padding: 24, paddingTop: 32 },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  displayName: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  username: { fontSize: 14, color: '#888', marginTop: 2 },
  bio: { fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  followSection: { padding: 16 },
  followBtn: { backgroundColor: '#E53935', borderRadius: 8, padding: 12, alignItems: 'center' },
  followBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  followingBtn: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 12, alignItems: 'center' },
  followingBtnText: { color: '#666', fontSize: 15, fontWeight: '600' },
  privateNotice: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  privateIcon: { fontSize: 40 },
  privateText: { fontSize: 17, fontWeight: '600', color: '#111' },
  privateSubtext: { fontSize: 14, color: '#888' },
  postsSection: { padding: 2 },
  gridItem: { flex: 1 / 3, margin: 1 },
  gridImage: { width: '100%', aspectRatio: 1 },
  gridNoImage: { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  noPostsText: { textAlign: 'center', color: '#999', fontSize: 14, paddingVertical: 32 },
});
