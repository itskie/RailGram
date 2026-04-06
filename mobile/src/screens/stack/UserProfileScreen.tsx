import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Grid3x3 } from 'lucide-react-native';
import { api } from '../../api/client';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

export default function UserProfileScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const THUMB = (width - 3) / 3;
  const { username } = route.params;
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', username],
    queryFn: async () => {
      const res = await api.get(`/users/${username}`);
      return res.data;
    },
  });

  const { data: postsData } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: async () => {
      const res = await api.get(`/users/${username}/posts`, { params: { limit: 30 } });
      return res.data;
    },
    enabled: !!profile,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (profile?.viewer_following) {
        await api.delete(`/users/${username}/follow`);
      } else {
        await api.post(`/users/${username}/follow`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', username] });
    },
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#FF6B35" /></View>;
  }
  if (!profile) {
    return <View style={styles.center}><Text style={styles.errText}>User not found</Text></View>;
  }

  const posts = postsData?.posts ?? postsData?.items ?? [];
  const avatarLetter = (profile.username || '?')[0].toUpperCase();

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerUsername}>@{profile.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Profile info */}
      <View style={styles.profileSection}>
        <View style={[styles.storyRing, profile.has_active_story && styles.storyRingActive]}>
          <View style={styles.avatarWrapper}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            )}
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile.post_count ?? 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile.follower_count ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile.following_count ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>

      {/* Bio */}
      <View style={styles.bioSection}>
        {profile.display_name && <Text style={styles.displayName}>{profile.display_name}</Text>}
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {/* Follow button */}
      <TouchableOpacity
        style={[styles.followBtn, profile.viewer_following && styles.followingBtn]}
        onPress={() => followMutation.mutate()}
        disabled={followMutation.isPending}
      >
        <Text style={[styles.followBtnText, profile.viewer_following && styles.followingBtnText]}>
          {profile.viewer_following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>

      {/* Posts grid */}
      <View style={styles.gridContainer}>
        {posts.map((post: any) => {
          const imageUrl = post.media_keys?.length ? `${CDN}${post.media_keys[0]}` : null;
          return (
            <TouchableOpacity
              key={post.id}
              style={styles.gridItem}
              onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.gridImg} resizeMode="cover" />
              ) : (
                <View style={[styles.gridImg, styles.gridPlaceholder]}>
                  <Text style={styles.gridPlaceholderText} numberOfLines={3}>{post.caption}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errText: { color: '#888' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  headerUsername: { color: '#fff', fontSize: 17, fontWeight: '700' },
  profileSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 20, gap: 20,
  },
  storyRing: {
    width: 88, height: 88, borderRadius: 44, padding: 3,
    borderWidth: 2.5, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  storyRingActive: { borderColor: '#FF6B35' },
  avatarWrapper: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 78, height: 78, borderRadius: 39 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 32 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#666', fontSize: 12, marginTop: 2 },
  bioSection: { paddingHorizontal: 16, marginBottom: 14 },
  displayName: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  bio: { color: '#888', fontSize: 13, lineHeight: 18 },
  followBtn: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#FF6B35', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333' },
  followBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  followingBtnText: { color: '#888' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  gridItem: { flex: 1/3, aspectRatio: 1 },
  gridImg: { flex: 1, backgroundColor: '#111' },
  gridPlaceholder: { justifyContent: 'center', alignItems: 'center', padding: 8 },
  gridPlaceholderText: { color: '#555', fontSize: 11, textAlign: 'center' },
});
